import { ButtonComponent, Notice, TFile, TFolder, ToggleComponent } from 'obsidian';
import { PropertyUtils } from '../utils/property-utils';
import { BasePropertiesModal } from './base-properties-modal';

/**
 * Modal for removing properties from files
 */
export class RemovePropertiesModal extends BasePropertiesModal {
  private selectedKeys: Set<string> = new Set();

  constructor(propertyUtils: PropertyUtils, files: TFile[], folder: TFolder | null = null) {
    super(propertyUtils, files, folder);
  }

  renderContent(container: HTMLElement) {
    container.createEl('h2', { text: 'Remove properties' });
    container.createEl('p', {
      text: `Removing properties from ${this.files.length} file(s)`,
      cls: 'properties-commander-subtitle',
    });

    if (this.existingProperties.size === 0) {
      container.createEl('p', {
        text: 'No properties found in selected files.',
        cls: 'properties-commander-no-items',
      });
      return;
    }

    container.createEl('p', {
      text: 'Toggle on the properties you want to remove:',
      cls: 'properties-commander-batch-desc',
    });

    const listContainer = container.createDiv({
      cls: 'properties-commander-list',
    });

    Array.from(this.existingProperties.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .forEach((prop) => {
        const itemEl = listContainer.createDiv({
          cls: 'properties-commander-list-item',
        });

        new ToggleComponent(itemEl).setValue(this.selectedKeys.has(prop.key)).onChange((value) => {
          if (value) {
            this.selectedKeys.add(prop.key);
          } else {
            this.selectedKeys.delete(prop.key);
          }
        });

        const labelContainer = itemEl.createDiv({
          cls: 'properties-commander-property-label',
        });
        labelContainer.createEl('span', {
          text: prop.key,
          cls: 'properties-commander-key',
        });

        const valuesPreview = Array.from(prop.values)
          .slice(0, 3)
          .map((v) => this.propertyUtils.formatValue(v))
          .join(', ');
        labelContainer.createEl('span', {
          text: valuesPreview + (prop.values.size > 3 ? '...' : ''),
          cls: 'properties-commander-values-preview',
        });
      });

    // Action buttons
    const buttonContainer = container.createDiv({
      cls: ['properties-commander-button-row', 'properties-commander-button-row-remove'],
    });

    new ButtonComponent(buttonContainer).setButtonText('Cancel').onClick(() => this.close());

    new ButtonComponent(buttonContainer)
      .setButtonText('Remove properties')
      .setCta()
      .onClick(() => this.handleSubmit());
  }

  protected onPropertiesReloaded() {
    this.selectedKeys.clear();
  }

  private async handleSubmit() {
    if (this.selectedKeys.size === 0) {
      new Notice('Please select at least one property to remove');
      return;
    }

    const keysToRemove = Array.from(this.selectedKeys);
    let successCount = 0;

    for (const file of this.files) {
      const removed = await this.propertyUtils.removePropertiesFromFile(file, keysToRemove);
      if (removed > 0) successCount++;
    }

    new Notice(`Removed ${keysToRemove.length} property(ies) from ${successCount} file(s)`);
    this.close();
  }
}
