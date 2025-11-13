const { Plugin, Notice } = require('obsidian');

module.exports = class SamplePlugin extends Plugin {
  async onload() {
    console.log('Sample plugin loaded.');
    this.addRibbonIcon('dice', 'Sample Plugin', () => {
      new Notice('Hello from Sample Plugin!');
    });
  }
};
