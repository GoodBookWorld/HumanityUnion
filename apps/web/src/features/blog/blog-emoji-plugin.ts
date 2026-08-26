/**
 * Pack 22G — local Unicode emoji insertion for Blog CKEditor.
 *
 * Native CKEditor Emoji exists under GPL in 48.4.0 but relies on remote emoji
 * definition hosting by default — Pack 22G forbids that dependency. This plugin
 * inserts plain Unicode text only (no HTML, no image-based emoji storage).
 */
import { createDropdown, IconEmoji, Plugin, View, type Editor, type Locale } from "ckeditor5";

import { BLOG_EMOJI_CATEGORIES } from "./blog-emoji-palette";

export const BLOG_EMOJI_TOOLBAR_ITEM = "blogEmoji";

function insertEmojiAtSelection(editor: Editor, emoji: string): void {
  editor.model.change((writer) => {
    const selection = editor.model.document.selection;
    if (!selection.isCollapsed) {
      const end = selection.getLastPosition();
      if (end) {
        writer.setSelection(end);
      }
    }
    const position = editor.model.document.selection.getFirstPosition();
    if (position) {
      writer.insertText(emoji, position);
    }
  });
  editor.editing.view.focus();
}

function fillEmojiGrid(grid: HTMLElement, categoryId: string, onPick: (emoji: string) => void): void {
  const category = BLOG_EMOJI_CATEGORIES.find((entry) => entry.id === categoryId);
  grid.replaceChildren();
  if (!category) {
    return;
  }
  for (const emoji of category.emojis) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "blog-ck-emoji-panel__emoji";
    button.setAttribute("role", "option");
    button.setAttribute("aria-label", `Insert ${emoji}`);
    button.dataset.emoji = emoji;
    button.textContent = emoji;
    button.addEventListener("click", () => {
      onPick(emoji);
    });
    grid.appendChild(button);
  }
}

class BlogEmojiPanelView extends View {
  constructor(locale: Locale, onPick: (emoji: string) => void) {
    super(locale);

    this.setTemplate({
      tag: "div",
      attributes: {
        class: ["blog-ck-emoji-panel"],
        tabindex: "-1",
      },
      children: [
        {
          tag: "div",
          attributes: {
            class: ["blog-ck-emoji-panel__categories"],
            role: "tablist",
            "aria-label": "Emoji categories",
          },
          children: BLOG_EMOJI_CATEGORIES.map((category) => ({
            tag: "button",
            attributes: {
              type: "button",
              class: ["blog-ck-emoji-panel__category", "ck", "ck-button"],
              role: "tab",
              "data-category": category.id,
              "aria-label": category.label,
            },
            children: [category.label],
          })),
        },
        {
          tag: "div",
          attributes: {
            class: ["blog-ck-emoji-panel__grid"],
            role: "listbox",
            "aria-label": "Emoji",
            "data-emoji-grid": "true",
          },
        },
      ],
    });

    this.on("render", () => {
      const root = this.element;
      if (!root) {
        return;
      }
      const grid = root.querySelector<HTMLElement>("[data-emoji-grid]");
      if (!grid) {
        return;
      }

      const activateCategory = (categoryId: string) => {
        for (const button of root.querySelectorAll<HTMLButtonElement>("[data-category]")) {
          const active = button.dataset.category === categoryId;
          button.setAttribute("aria-selected", active ? "true" : "false");
          button.classList.toggle("blog-ck-emoji-panel__category--active", active);
        }
        fillEmojiGrid(grid, categoryId, onPick);
      };

      root.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        const categoryButton = target.closest<HTMLButtonElement>("[data-category]");
        if (categoryButton?.dataset.category) {
          activateCategory(categoryButton.dataset.category);
        }
      });

      activateCategory(BLOG_EMOJI_CATEGORIES[0]!.id);
    });
  }
}

export class BlogEmojiPlugin extends Plugin {
  public static get pluginName() {
    return "BlogEmoji" as const;
  }

  public init(): void {
    const editor = this.editor;
    const t = editor.t.bind(editor);

    editor.ui.componentFactory.add(BLOG_EMOJI_TOOLBAR_ITEM, (locale) => {
      const dropdown = createDropdown(locale);
      dropdown.buttonView.set({
        label: t("Emoji"),
        icon: IconEmoji,
        tooltip: true,
      });
      dropdown.panelView.extendTemplate({
        attributes: {
          class: ["blog-ck-emoji-dropdown"],
        },
      });

      const panel = new BlogEmojiPanelView(locale, (emoji) => {
        insertEmojiAtSelection(editor, emoji);
        dropdown.isOpen = false;
        editor.editing.view.focus();
      });
      dropdown.panelView.children.add(panel);

      return dropdown;
    });
  }
}
