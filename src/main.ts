import { Menu, Plugin, TAbstractFile, TFile, TFolder } from 'obsidian';
import {
  AddPropertiesModal,
  EditValuesModal,
  FileSelectionModal,
  RemovePropertiesModal,
  RenamePropertiesModal,
} from './modals';
import { PropertyUtils } from './utils/property-utils';

/**
 * Properties Commander - Advanced frontmatter properties management for Obsidian
 *
 * This plugin provides tools to add, remove, and edit properties across
 * files and folders with ease.
 */
export default class PropertiesCommanderPlugin extends Plugin {
  private propertyUtils!: PropertyUtils;

  async onload() {
    console.debug('Loading Properties Commander plugin');

    // Initialize utilities
    this.propertyUtils = new PropertyUtils(this.app);

    // Register features
    this.registerContextMenuEvents();
    this.registerCommands();
  }

  onunload() {
    console.debug('Unloading Properties Commander plugin');
  }

  // ========================================================================
  // Context Menu Registration
  // ========================================================================

  private registerContextMenuEvents() {
    // Single file/folder context menu
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file, source) => {
        if (source === 'file-explorer-context-menu') {
          this.addPropertiesCommanderMenu(menu, file);
        }
      }),
    );

    // Multiple files context menu
    this.registerEvent(
      this.app.workspace.on('files-menu', (menu, files, source) => {
        if (source === 'file-explorer-context-menu') {
          this.addPropertiesCommanderMenuForFiles(menu, files);
        }
      }),
    );
  }

  private addPropertiesCommanderMenu(menu: Menu, file: TAbstractFile) {
    // Only show for markdown files or folders containing markdown files
    if (file instanceof TFile) {
      if (file.extension !== 'md') return;
    } else if (file instanceof TFolder) {
      const mdFiles = this.propertyUtils.getFilesFromFolder(file, true, -1);
      if (mdFiles.length === 0) return;
    } else {
      return;
    }

    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle('Properties commander').setIcon('list');

      const subMenu = (item as unknown as { setSubmenu: () => Menu }).setSubmenu();

      if (file instanceof TFolder) {
        this.addFolderMenuItems(subMenu, file);
      } else if (file instanceof TFile) {
        this.addFileMenuItems(subMenu, file);
      }
    });
  }

  private addFolderMenuItems(subMenu: Menu, folder: TFolder) {
    subMenu.addItem((subItem) => {
      subItem
        .setTitle('Add properties...')
        .setIcon('plus')
        .onClick(() => {
          const files = this.propertyUtils.getFilesFromFolder(folder, true, -1);
          new AddPropertiesModal(this.propertyUtils, files, folder).open();
        });
    });

    subMenu.addItem((subItem) => {
      subItem
        .setTitle('Remove properties...')
        .setIcon('minus')
        .onClick(() => {
          const files = this.propertyUtils.getFilesFromFolder(folder, true, -1);
          new RemovePropertiesModal(this.propertyUtils, files, folder).open();
        });
    });

    subMenu.addSeparator();

    subMenu.addItem((subItem) => {
      subItem
        .setTitle('Rename properties...')
        .setIcon('pencil')
        .onClick(() => {
          const files = this.propertyUtils.getFilesFromFolder(folder, true, -1);
          new RenamePropertiesModal(this.propertyUtils, files, folder).open();
        });
    });

    subMenu.addItem((subItem) => {
      subItem
        .setTitle('Edit property values...')
        .setIcon('form-input')
        .onClick(() => {
          const files = this.propertyUtils.getFilesFromFolder(folder, true, -1);
          new EditValuesModal(this.propertyUtils, files, folder).open();
        });
    });
  }

  private addFileMenuItems(subMenu: Menu, file: TFile) {
    subMenu.addItem((subItem) => {
      subItem
        .setTitle('Add properties...')
        .setIcon('plus')
        .onClick(() => {
          new AddPropertiesModal(this.propertyUtils, [file]).open();
        });
    });

    subMenu.addItem((subItem) => {
      subItem
        .setTitle('Remove properties...')
        .setIcon('minus')
        .onClick(() => {
          new RemovePropertiesModal(this.propertyUtils, [file]).open();
        });
    });

    subMenu.addSeparator();

    subMenu.addItem((subItem) => {
      subItem
        .setTitle('Rename properties...')
        .setIcon('pencil')
        .onClick(() => {
          new RenamePropertiesModal(this.propertyUtils, [file]).open();
        });
    });

    subMenu.addItem((subItem) => {
      subItem
        .setTitle('Edit property values...')
        .setIcon('form-input')
        .onClick(() => {
          new EditValuesModal(this.propertyUtils, [file]).open();
        });
    });
  }

  private addPropertiesCommanderMenuForFiles(menu: Menu, files: TAbstractFile[]) {
    const mdFiles = files.filter((f): f is TFile => f instanceof TFile && f.extension === 'md');

    if (mdFiles.length === 0) return;

    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle('Properties commander').setIcon('list');

      const subMenu = (item as unknown as { setSubmenu: () => Menu }).setSubmenu();

      subMenu.addItem((subItem) => {
        subItem
          .setTitle(`Add properties to ${mdFiles.length} files...`)
          .setIcon('plus')
          .onClick(() => {
            new AddPropertiesModal(this.propertyUtils, mdFiles).open();
          });
      });

      subMenu.addItem((subItem) => {
        subItem
          .setTitle(`Remove properties from ${mdFiles.length} files...`)
          .setIcon('minus')
          .onClick(() => {
            new RemovePropertiesModal(this.propertyUtils, mdFiles).open();
          });
      });

      subMenu.addSeparator();

      subMenu.addItem((subItem) => {
        subItem
          .setTitle(`Rename properties in ${mdFiles.length} files...`)
          .setIcon('pencil')
          .onClick(() => {
            new RenamePropertiesModal(this.propertyUtils, mdFiles).open();
          });
      });

      subMenu.addItem((subItem) => {
        subItem
          .setTitle(`Edit property values in ${mdFiles.length} files...`)
          .setIcon('form-input')
          .onClick(() => {
            new EditValuesModal(this.propertyUtils, mdFiles).open();
          });
      });
    });
  }

  // ========================================================================
  // Command Registration
  // ========================================================================

  private registerCommands() {
    this.addCommand({
      id: 'add-properties',
      name: 'Add properties...',
      callback: () => new FileSelectionModal(this.propertyUtils, 'add').open(),
    });

    this.addCommand({
      id: 'remove-properties',
      name: 'Remove properties...',
      callback: () => new FileSelectionModal(this.propertyUtils, 'remove').open(),
    });

    this.addCommand({
      id: 'rename-properties',
      name: 'Rename properties...',
      callback: () => new FileSelectionModal(this.propertyUtils, 'rename').open(),
    });

    this.addCommand({
      id: 'edit-property-values',
      name: 'Edit property values...',
      callback: () => new FileSelectionModal(this.propertyUtils, 'edit-values').open(),
    });
  }
}
