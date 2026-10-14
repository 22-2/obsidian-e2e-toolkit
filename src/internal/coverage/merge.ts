import libCoverage from "istanbul-lib-coverage";
import type { CoverageMapData, FileCoverageData, Range } from "istanbul-lib-coverage";
import path from "node:path";

type FileCoverageWithTruthiness = FileCoverageData & { bT?: Record<string, number[]> };

function locationKey(location: Range): string {
    return `${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}`;
}

/** Preserve source locations when different compilers emit different coverage maps. */
export function mergeIstanbulCoverage(inputs: readonly CoverageMapData[]) {
    const files = new Map<string, FileCoverageWithTruthiness>();
    for (const input of inputs) {
        const inputMap = libCoverage.createCoverageMap(input);
        for (const filename of inputMap.files()) {
            const source = inputMap.fileCoverageFor(filename).data as FileCoverageWithTruthiness;
            const filenameKey = path.resolve(source.path);
            const target = files.get(filenameKey) ?? libCoverage.createFileCoverage(filenameKey).data as FileCoverageWithTruthiness;
            files.set(filenameKey, target);
            const statements = new Map(Object.entries(target.statementMap).map(([id, location]) => [locationKey(location), id]));
            for (const [sourceId, location] of Object.entries(source.statementMap)) {
                const key = locationKey(location);
                let id = statements.get(key);
                if (id === undefined) {
                    id = String(statements.size);
                    statements.set(key, id);
                    target.statementMap[id] = location;
                    target.s[id] = 0;
                }
                target.s[id] += source.s[sourceId];
            }
            const functions = new Map(Object.entries(target.fnMap).map(([id, fn]) => [locationKey(fn.loc), id]));
            for (const [sourceId, fn] of Object.entries(source.fnMap)) {
                const key = locationKey(fn.loc);
                let id = functions.get(key);
                if (id === undefined) {
                    id = String(functions.size);
                    functions.set(key, id);
                    target.fnMap[id] = fn;
                    target.f[id] = 0;
                }
                target.f[id] += source.f[sourceId];
            }
            // Istanbul's default merger matches only the first branch location
            // and adds arm counts by index. That can lose arms or misattribute
            // hits when Vitest and a bundled E2E build have different mappings.
            const branchKey = (branch: FileCoverageData["branchMap"][string]) =>
                JSON.stringify([branch.type, branch.locations.map(locationKey)]);
            const branches = new Map(Object.entries(target.branchMap).map(([id, branch]) => [branchKey(branch), id]));
            for (const [sourceId, branch] of Object.entries(source.branchMap)) {
                const key = branchKey(branch);
                let id = branches.get(key);
                if (id === undefined) {
                    id = String(branches.size);
                    branches.set(key, id);
                    target.branchMap[id] = branch;
                    target.b[id] = branch.locations.map(() => 0);
                }
                branch.locations.forEach((_, index) => {
                    target.b[id][index] += source.b[sourceId][index];
                });
                if (source.bT?.[sourceId]) {
                    target.bT ??= {};
                    target.bT[id] ??= branch.locations.map(() => 0);
                    branch.locations.forEach((_, index) => { target.bT![id][index] += source.bT![sourceId][index]; });
                }
            }
        }
    }
    return libCoverage.createCoverageMap(Object.fromEntries(files));
}
