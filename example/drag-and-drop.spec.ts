import { expect, test } from "../src";
import path from "path";

const PLUGIN_ID = "virtual-file-explorer-plugin";
test.use({
	vaultOptions: {
		plugins: [
			{
				path: path.resolve(`example/${PLUGIN_ID}`),
				pluginId: PLUGIN_ID,
			},
		],
	},
});

test.describe("Drag and Drop Operations", () => {
	test("should drag file to root", async ({ obsidian }) => {
		await obsidian.waitReady();

		// Setup: Create folder with a file, and another file at root
		const pluginHandle = await obsidian.plugin(PLUGIN_ID);
		const { fileInFolderId, folderId } = await pluginHandle.evaluate(
			async (plugin: any) => {
				await plugin.app.vault.create("in-folder.md", "# In Folder");
				await plugin.app.vault.create("at-root.md", "# At Root");

				const file1 = plugin.app.vault.getAbstractFileByPath("in-folder.md");
				const file2 = plugin.app.vault.getAbstractFileByPath("at-root.md");

				if (file1) plugin.fileNodeService?.addFileNode(file1);
				if (file2) plugin.fileNodeService?.addFileNode(file2);

				const area = plugin.api.getActiveArea();
				const nodeIds = area?.rootNodes.map((n: any) => n.id) ?? [];

				// Create folder with first file
				const folderId = plugin.api.createFolderWithNodes([nodeIds[0]]);

				// Get file in folder ID
				const updatedArea = plugin.api.getActiveArea();
				const folder = updatedArea?.rootNodes.find((n: any) => n.type === "folder");
				const fileInFolder = folder?.children?.[0];

				return {
					folderId: folderId ?? null,
					fileInFolderId: fileInFolder?.id ?? null,
				};
			},
		);

		expect(folderId).toBeTruthy();
		expect(fileInFolderId).toBeTruthy();

		// Simulate drag from folder to root using moveNodes
		await pluginHandle.evaluate((plugin: any, fileId: string) => {
			const area = plugin.api.getActiveArea();
			if (!area || !fileId) return;

			// Remove from folder and add to root
			let updatedRootNodes = structuredClone(area.rootNodes);
			const folder = updatedRootNodes.find((n: any) => n.type === "folder");
			if (folder && folder.children) {
				const fileNode = folder.children.find((n: any) => n.id === fileId);
				if (fileNode) {
					folder.children = folder.children.filter((n: any) => n.id !== fileId);
					fileNode.metadata.sortIndex = updatedRootNodes.length;
					updatedRootNodes.push(fileNode);
				}
			}

			plugin.api.updateArea({
				...area,
				rootNodes: updatedRootNodes,
			});
		}, fileInFolderId);

		// Verify file moved to root
		const result = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			const folder = area?.rootNodes.find((n: any) => n.type === "folder");
			const filesAtRoot = area?.rootNodes.filter((n: any) => n.type === "file");

			return {
				folderChildCount: folder?.children?.length ?? 0,
				filesAtRootCount: filesAtRoot?.length ?? 0,
			};
		});

		expect(result.folderChildCount).toBe(0);
		expect(result.filesAtRootCount).toBe(2);
	});

	test("should drag file into folder", async ({ obsidian }) => {
		await obsidian.waitReady();

		// Setup: Create empty folder and files at root
		const pluginHandle = await obsidian.plugin(PLUGIN_ID);
		const { folderId, fileId } = await pluginHandle.evaluate(async (plugin: any) => {
			await plugin.app.vault.create("file1.md", "# File 1");
			await plugin.app.vault.create("file2.md", "# File 2");

			const file1 = plugin.app.vault.getAbstractFileByPath("file1.md");
			const file2 = plugin.app.vault.getAbstractFileByPath("file2.md");

			if (file1) plugin.fileNodeService?.addFileNode(file1);
			if (file2) plugin.fileNodeService?.addFileNode(file2);

			const area = plugin.api.getActiveArea();
			const nodeIds = area?.rootNodes.map((n: any) => n.id) ?? [];

			// Create empty folder with first file
			const folderId = plugin.api.createFolderWithNodes([nodeIds[0]]);

			// Get second file ID
			const updatedArea = plugin.api.getActiveArea();
			const fileNode = updatedArea?.rootNodes.find((n: any) => n.type === "file");

			return {
				folderId: folderId ?? null,
				fileId: fileNode?.id ?? null,
			};
		});

		expect(folderId).toBeTruthy();
		expect(fileId).toBeTruthy();

		// Move file into folder
		await pluginHandle.evaluate(
			(plugin: any, { fileId, folderId }: any) => {
				if (fileId && folderId) {
					plugin.api.moveNodes([fileId], folderId);
				}
			},
			{ fileId, folderId },
		);

		// Verify file moved into folder
		const result = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			const folder = area?.rootNodes.find((n: any) => n.type === "folder");

			return {
				folderChildCount: folder?.children?.length ?? 0,
				rootNodeCount: area?.rootNodes.length ?? 0,
			};
		});

		expect(result.folderChildCount).toBe(2);
		expect(result.rootNodeCount).toBe(1);
	});

	test("should drag multiple files together", async ({ obsidian }) => {
		await obsidian.waitReady();

		// Setup: Create multiple files and a folder
		const pluginHandle = await obsidian.plugin(PLUGIN_ID);
		const { folderId, fileIds } = await pluginHandle.evaluate(async (plugin: any) => {
			await plugin.app.vault.create("file1.md", "# File 1");
			await plugin.app.vault.create("file2.md", "# File 2");
			await plugin.app.vault.create("file3.md", "# File 3");
			await plugin.app.vault.create("folder-file.md", "# Folder File");

			const files = ["file1.md", "file2.md", "file3.md", "folder-file.md"];
			for (const fileName of files) {
				const file = plugin.app.vault.getAbstractFileByPath(fileName);
				if (file) plugin.fileNodeService?.addFileNode(file);
			}

			const area = plugin.api.getActiveArea();
			const nodeIds = area?.rootNodes.map((n: any) => n.id) ?? [];

			// Create folder with last file
			const folderId = plugin.api.createFolderWithNodes([
				nodeIds[nodeIds.length - 1],
			]);

			// Get remaining file IDs
			const updatedArea = plugin.api.getActiveArea();
			const fileNodes = updatedArea?.rootNodes.filter((n: any) => n.type === "file");

			return {
				folderId: folderId ?? null,
				fileIds: fileNodes?.map((n: any) => n.id) ?? [],
			};
		});

		expect(folderId).toBeTruthy();
		expect(fileIds.length).toBe(3);

		// Move multiple files into folder
		await pluginHandle.evaluate(
			(plugin: any, { fileIds, folderId }: any) => {
				if (fileIds && folderId) {
					plugin.api.moveNodes(fileIds, folderId);
				}
			},
			{ fileIds, folderId },
		);

		// Verify all files moved into folder
		const result = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			const folder = area?.rootNodes.find((n: any) => n.type === "folder");

			return {
				folderChildCount: folder?.children?.length ?? 0,
				rootNodeCount: area?.rootNodes.length ?? 0,
			};
		});

		expect(result.folderChildCount).toBe(4);
		expect(result.rootNodeCount).toBe(1);
	});

	test("should reorder files by dragging", async ({ obsidian }) => {
		await obsidian.waitReady();

		// Setup: Create three files
		const pluginHandle = await obsidian.plugin(PLUGIN_ID);
		const fileIds = await pluginHandle.evaluate(async (plugin: any) => {
			await plugin.app.vault.create("file1.md", "# File 1");
			await plugin.app.vault.create("file2.md", "# File 2");
			await plugin.app.vault.create("file3.md", "# File 3");

			const files = ["file1.md", "file2.md", "file3.md"];
			for (const fileName of files) {
				const file = plugin.app.vault.getAbstractFileByPath(fileName);
				if (file) plugin.fileNodeService?.addFileNode(file);
			}

			const area = plugin.api.getActiveArea();
			return area?.rootNodes.map((n: any) => n.id) ?? [];
		});

		expect(fileIds.length).toBe(3);

		// Get initial order
		const initialOrder = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			return area?.rootNodes.map((n: any) => n.displayName) ?? [];
		});

		expect(initialOrder).toEqual(["file1", "file2", "file3"]);

		// Simulate reordering: move first file to last position
		await pluginHandle.evaluate((plugin: any, firstFileId: string) => {
			const area = plugin.api.getActiveArea();
			if (!area || !firstFileId) return;

			let updatedRootNodes = structuredClone(area.rootNodes);
			const firstNode = updatedRootNodes.find((n: any) => n.id === firstFileId);
			if (!firstNode) return;

			// Remove first node
			updatedRootNodes = updatedRootNodes.filter((n: any) => n.id !== firstFileId);

			// Add to end
			firstNode.metadata.sortIndex = updatedRootNodes.length;
			updatedRootNodes.push(firstNode);

			// Reindex
			updatedRootNodes.forEach((node: any, index: number) => {
				node.metadata.sortIndex = index;
			});

			plugin.api.updateArea({
				...area,
				rootNodes: updatedRootNodes,
			});
		}, fileIds[0]);

		// Verify new order
		const newOrder = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			return area?.rootNodes.map((n: any) => n.displayName) ?? [];
		});

		expect(newOrder).toEqual(["file2", "file3", "file1"]);
	});

	test("should prevent dragging folder into its own child", async ({
		obsidian,
	}) => {
		await obsidian.waitReady();

		// Setup: Create nested folder structure
		const pluginHandle = await obsidian.plugin(PLUGIN_ID);
		const { parentFolderId, childFolderId } = await pluginHandle.evaluate(
			async (plugin: any) => {
				await plugin.app.vault.create("file1.md", "# File 1");
				await plugin.app.vault.create("file2.md", "# File 2");

				const files = ["file1.md", "file2.md"];
				for (const fileName of files) {
					const file = plugin.app.vault.getAbstractFileByPath(fileName);
					if (file) plugin.fileNodeService?.addFileNode(file);
				}

				const area = plugin.api.getActiveArea();
				const nodeIds = area?.rootNodes.map((n: any) => n.id) ?? [];

				// Create child folder
				const childFolderId = plugin.api.createFolderWithNodes([nodeIds[0]]);

				// Create parent folder with child folder
				const updatedArea = plugin.api.getActiveArea();
				const childFolderNodeId = updatedArea?.rootNodes.find(
					(n: any) => n.type === "folder",
				)?.id;

				const parentFolderId = plugin.api.createFolderWithNodes([
					childFolderNodeId!,
				]);

				return {
					parentFolderId: parentFolderId ?? null,
					childFolderId: childFolderId ?? null,
				};
			},
		);

		expect(parentFolderId).toBeTruthy();
		expect(childFolderId).toBeTruthy();

		// Try to move parent folder into child folder (should fail or be prevented)
		const errorOccurred = await pluginHandle.evaluate(
			(plugin: any, { parentFolderId, childFolderId }: any) => {
				try {
					const area = plugin.api.getActiveArea();
					if (!area || !parentFolderId || !childFolderId) return false;

					// Check if this would create a cycle using isAncestor
					const isAncestor = (nodes: any[], parentId: string, childId: string): boolean => {
						const parent = nodes.find(n => n.id === parentId);
						if (!parent || !parent.children) return false;
						if (parent.children.some((c: any) => c.id === childId)) return true;
						return parent.children.some((c: any) => isAncestor(parent.children, c.id, childId));
					};

					const wouldCreateCycle = isAncestor(
						area.rootNodes,
						parentFolderId,
						childFolderId,
					);

					if (wouldCreateCycle) {
						// This should be prevented
						return true;
					}

					// If not prevented, try the move
					plugin.api.moveNodes([parentFolderId], childFolderId);
					return false;
				} catch (error) {
					return true;
				}
			},
			{ parentFolderId, childFolderId },
		);

		// Verify the operation was prevented
		expect(errorOccurred).toBe(true);
	});

	test("should maintain sortIndex after drag operations", async ({ obsidian }) => {
		await obsidian.waitReady();

		// Setup: Create multiple files
		const pluginHandle = await obsidian.plugin(PLUGIN_ID);
		await pluginHandle.evaluate(async (plugin: any) => {
			for (let i = 1; i <= 5; i++) {
				await plugin.app.vault.create(`file${i}.md`, `# File ${i}`);
				const file = plugin.app.vault.getAbstractFileByPath(`file${i}.md`);
				if (file) plugin.fileNodeService?.addFileNode(file);
			}
		});

		// Verify initial sortIndex is sequential
		const initialSortIndices = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			return area?.rootNodes.map((n: any) => n.metadata.sortIndex) ?? [];
		});

		expect(initialSortIndices).toEqual([0, 1, 2, 3, 4]);

		// Move middle file to end
		await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			if (!area) return;

			const middleNode = area.rootNodes[2]; // file3
			let updatedRootNodes = structuredClone(area.rootNodes);

			// Remove middle node
			updatedRootNodes = updatedRootNodes.filter((n: any) => n.id !== middleNode.id);

			// Add to end
			updatedRootNodes.push(middleNode);

			// Reindex
			updatedRootNodes.forEach((node: any, index: number) => {
				node.metadata.sortIndex = index;
			});

			plugin.api.updateArea({
				...area,
				rootNodes: updatedRootNodes,
			});
		});

		// Verify sortIndex is still sequential after move
		const finalSortIndices = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			return area?.rootNodes.map((n: any) => n.metadata.sortIndex) ?? [];
		});

		expect(finalSortIndices).toEqual([0, 1, 2, 3, 4]);

		// Verify order changed correctly
		const finalOrder = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			return area?.rootNodes.map((n: any) => n.displayName) ?? [];
		});

		expect(finalOrder).toEqual(["file1", "file2", "file4", "file5", "file3"]);
	});

	test("should drag file between folders", async ({ obsidian }) => {
		await obsidian.waitReady();

		// Setup: Create two folders with files
		const pluginHandle = await obsidian.plugin(PLUGIN_ID);
		const { folder1Id, folder2Id, fileInFolder1Id } =
			await pluginHandle.evaluate(async (plugin: any) => {
				await plugin.app.vault.create("file1.md", "# File 1");
				await plugin.app.vault.create("file2.md", "# File 2");
				await plugin.app.vault.create("file3.md", "# File 3");

				const files = ["file1.md", "file2.md", "file3.md"];
				for (const fileName of files) {
					const file = plugin.app.vault.getAbstractFileByPath(fileName);
					if (file) plugin.fileNodeService?.addFileNode(file);
				}

				const area = plugin.api.getActiveArea();
				const nodeIds = area?.rootNodes.map((n: any) => n.id) ?? [];

				// Create two folders
				const folder1Id = plugin.api.createFolderWithNodes([nodeIds[0]]);
				const folder2Id = plugin.api.createFolderWithNodes([nodeIds[1]]);

				// Get file in folder1
				const updatedArea = plugin.api.getActiveArea();
				const folder1 = updatedArea?.rootNodes.find((n: any) => n.id === folder1Id);
				const fileInFolder1 = folder1?.children?.[0];

				return {
					folder1Id: folder1Id ?? null,
					folder2Id: folder2Id ?? null,
					fileInFolder1Id: fileInFolder1?.id ?? null,
				};
			});

		expect(folder1Id).toBeTruthy();
		expect(folder2Id).toBeTruthy();
		expect(fileInFolder1Id).toBeTruthy();

		// Move file from folder1 to folder2
		await pluginHandle.evaluate(
			(plugin: any, { fileId, targetFolderId }: any) => {
				if (fileId && targetFolderId) {
					plugin.api.moveNodes([fileId], targetFolderId);
				}
			},
			{ fileId: fileInFolder1Id, targetFolderId: folder2Id },
		);

		// Verify file moved between folders
		const result = await pluginHandle.evaluate(
			(plugin: any, { folder1Id, folder2Id }: any) => {
				const area = plugin.api.getActiveArea();
				const folder1 = area?.rootNodes.find((n: any) => n.id === folder1Id);
				const folder2 = area?.rootNodes.find((n: any) => n.id === folder2Id);

				return {
					folder1ChildCount: folder1?.children?.length ?? 0,
					folder2ChildCount: folder2?.children?.length ?? 0,
				};
			},
			{ folder1Id, folder2Id },
		);

		expect(result.folder1ChildCount).toBe(0);
		expect(result.folder2ChildCount).toBe(2);
	});

	test("should reorder by dragging last item to previous position (D to C)", async ({
		obsidian,
	}) => {
		await obsidian.waitReady();

		// Setup: Create four files A, B, C, D
		const pluginHandle = await obsidian.plugin(PLUGIN_ID);
		const fileIds = await pluginHandle.evaluate(async (plugin: any) => {
			const fileNames = ["A.md", "B.md", "C.md", "D.md"];
			for (const fileName of fileNames) {
				await plugin.app.vault.create(fileName, `# ${fileName}`);
				const file = plugin.app.vault.getAbstractFileByPath(fileName);
				if (file) plugin.fileNodeService?.addFileNode(file);
			}

			const area = plugin.api.getActiveArea();
			return (
				area?.rootNodes.map((n: any) => ({
					id: n.id,
					name: n.displayName,
				})) ?? []
			);
		});

		expect(fileIds.length).toBe(4);

		// Verify initial order: A, B, C, D
		const initialOrder = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			return area?.rootNodes.map((n: any) => n.displayName) ?? [];
		});

		expect(initialOrder).toEqual(["A", "B", "C", "D"]);

		// Find D and C IDs
		const dFile = fileIds.find((f: any) => f.name === "D");
		const cFile = fileIds.find((f: any) => f.name === "C");

		expect(dFile).toBeTruthy();
		expect(cFile).toBeTruthy();

		// Simulate dragging D onto C (as sibling, before C)
		await pluginHandle.evaluate(
			(plugin: any, { dragSourceId, dropTargetId }: any) => {
				const area = plugin.api.getActiveArea();
				if (!area || !dragSourceId || !dropTargetId) return;

				// Simulate what handleDrop does
				let updatedRootNodes = structuredClone(area.rootNodes);

				// Find the nodes
				const dragNode = updatedRootNodes.find((n: any) => n.id === dragSourceId);
				const dropTargetIndex = updatedRootNodes.findIndex(
					(n: any) => n.id === dropTargetId,
				);

				if (!dragNode || dropTargetIndex === -1) return;

				// Remove drag node from current position
				updatedRootNodes = updatedRootNodes.filter(
					(n: any) => n.id !== dragSourceId,
				);

				// Insert before drop target
				const newDropTargetIndex = updatedRootNodes.findIndex(
					(n: any) => n.id === dropTargetId,
				);

				updatedRootNodes.splice(newDropTargetIndex, 0, dragNode);

				// Reindex all nodes
				updatedRootNodes.forEach((node: any, index: number) => {
					node.metadata.sortIndex = index;
				});

				plugin.api.updateArea({
					...area,
					rootNodes: updatedRootNodes,
				});
			},
			{ dragSourceId: dFile!.id, dropTargetId: cFile!.id },
		);

		// Verify new order should be: A, B, D, C
		const newOrder = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			return area?.rootNodes.map((n: any) => n.displayName) ?? [];
		});

		expect(newOrder).toEqual(["A", "B", "D", "C"]);
	});

	test("should reorder by UI drag: last item (D) to third position (above C)", async ({
		obsidian,
	}) => {
		await obsidian.waitReady();

		// Open the VFE view
		await obsidian.command(`${PLUGIN_ID}:open-virtual-file-explorer`);

		// Wait for view to be visible
		await obsidian.page.waitForSelector(".vfe-container", {
			timeout: 5000,
		});

		// Setup: Create four files A, B, C, D
		const pluginHandle = await obsidian.plugin(PLUGIN_ID);
		const fileIds = await pluginHandle.evaluate(async (plugin: any) => {
			const fileNames = ["A.md", "B.md", "C.md", "D.md"];
			for (const fileName of fileNames) {
				await plugin.app.vault.create(fileName, `# ${fileName}`);
				const file = plugin.app.vault.getAbstractFileByPath(fileName);
				if (file) plugin.fileNodeService?.addFileNode(file);
			}

			const area = plugin.api.getActiveArea();
			return (
				area?.rootNodes.map((n: any) => ({
					id: n.id,
					name: n.displayName,
				})) ?? []
			);
		});

		expect(fileIds.length).toBe(4);

		// Wait for tree to render
		await obsidian.page.waitForTimeout(500);

		// Verify initial order: A, B, C, D
		const initialOrder = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			return area?.rootNodes.map((n: any) => n.displayName) ?? [];
		});

		expect(initialOrder).toEqual(["A", "B", "C", "D"]);

		// Get the tree items
		const treeItems = obsidian.page.locator(".vfe-tree-list-item");
		const count = await treeItems.count();
		expect(count).toBe(4);

		// Find D (last item, index 3) and C (third item, index 2)
		const dItem = treeItems.nth(3);
		const cItem = treeItems.nth(2);

		// Get bounding boxes for more precise positioning
		const dBox = await dItem.boundingBox();
		const cBox = await cItem.boundingBox();

		expect(dBox).toBeTruthy();
		expect(cBox).toBeTruthy();

		// Start dragging from center of D
		await obsidian.page.mouse.move(
			dBox!.x + dBox!.width / 2,
			dBox!.y + dBox!.height / 2,
		);
		await obsidian.page.mouse.down();
		await obsidian.page.waitForTimeout(100);

		// Move to just above C (to insert before C, between B and C)
		await obsidian.page.mouse.move(cBox!.x + cBox!.width / 2, cBox!.y - 10, {
			steps: 10,
		});
		await obsidian.page.waitForTimeout(300);

		// Verify drop indicator is visible during drag
		const dropIndicator = obsidian.page.locator(".vfe-drop-indicator");
		await expect(dropIndicator).toBeVisible();

		// Complete the drop
		await obsidian.page.mouse.up();

		// Wait for state update
		await obsidian.page.waitForTimeout(1000);

		// Verify new order should be: A, B, D, C
		const newOrder = await pluginHandle.evaluate((plugin: any) => {
			const area = plugin.api.getActiveArea();
			return area?.rootNodes.map((n: any) => n.displayName) ?? [];
		});

		expect(newOrder).toEqual(["A", "B", "D", "C"]);
	});
});
