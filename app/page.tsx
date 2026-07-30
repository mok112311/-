"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SAMPLE_TITLE = "AI 加速了科学，也在掏空大学是不是是不是";

const SAMPLE = `真正的变化，往往不是从一声巨响开始的。

它先出现在一些微小的瞬间：一段更像人的回答，一次不再需要反复修改的协作，一项昨天还被认为不可能完成的任务。

当能力的边界继续向前，写作者真正需要的，也许不是更快地产出，而是重新拿回对节奏、判断与表达的控制。`;

const TARGET = "过去几年，他们负责把 AI 推向更高的能力边界";
const TITLE_LIMIT = 20;

type ArticleImage = {
  id: string;
  name: string;
  url: string;
};

function formatReadTime(count: number) {
  return Math.max(1, Math.ceil(count / 400));
}

function countTitleCharacters(value: string) {
  return Array.from(value).filter((character) => !/\s/u.test(character)).length;
}

function limitTitle(value: string) {
  const singleLine = value.replace(/[\r\n]+/g, " ");
  let count = 0;
  let result = "";

  for (const character of Array.from(singleLine)) {
    if (!/\s/u.test(character)) {
      if (count >= TITLE_LIMIT) break;
      count += 1;
    }
    result += character;
  }

  return result;
}

export default function Home() {
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [content, setContent] = useState(SAMPLE);
  const [fontSize, setFontSize] = useState(15);
  const [lineHeight, setLineHeight] = useState(1.85);
  const [showGrid, setShowGrid] = useState(true);
  const [copied, setCopied] = useState(false);
  const [images, setImages] = useState<ArticleImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewTitleRef = useRef<HTMLHeadingElement>(null);
  const previewBodyRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const insertAtCaretRef = useRef(false);

  const stats = useMemo(() => {
    const clean = content.replace(/\s/g, "");
    const paragraphs = content.split(/\n\s*\n/).filter((item) => item.trim());
    return {
      characters: clean.length,
      paragraphs: paragraphs.length,
      minutes: formatReadTime(clean.length),
    };
  }, [content]);
  const titleCount = countTitleCharacters(title);

  function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function createCopyHtml() {
    const article = document.createElement("article");
    article.style.cssText =
      "max-width:520px;margin:0 auto;color:#18201c;font-family:PingFang SC,Noto Sans CJK SC,Microsoft YaHei,sans-serif;font-size:15px;line-height:1.85;";

    if (title.trim()) {
      const heading = document.createElement("h1");
      heading.textContent = title.trim();
      heading.style.cssText =
        "margin:0 0 32px;font-size:28px;line-height:1.42;font-weight:700;font-family:PingFang SC,Noto Sans CJK SC,Microsoft YaHei,sans-serif;";
      article.append(heading);
    }

    const body = previewBodyRef.current?.cloneNode(true) as HTMLElement | undefined;
    if (body) {
      body.removeAttribute("contenteditable");
      body.removeAttribute("aria-label");
      body.querySelectorAll("button").forEach((button) => button.remove());
      body.querySelectorAll<HTMLElement>("figure").forEach((figure) => {
        figure.removeAttribute("contenteditable");
        figure.style.cssText = "margin:32px 0;";
      });
      body.querySelectorAll<HTMLElement>("figcaption").forEach((caption) => {
        caption.style.cssText =
          "margin-top:8px;color:#929892;font-size:12px;line-height:1.5;text-align:center;";
      });

      const copiedImages = Array.from(body.querySelectorAll<HTMLImageElement>("img"));
      await Promise.all(
        copiedImages.map(async (image) => {
          const blob = await fetch(image.src).then((response) => response.blob());
          image.src = await blobToDataUrl(blob);
          image.style.cssText =
            "display:block;width:100%;height:auto;object-fit:contain;";
        }),
      );

      body.style.cssText = "white-space:pre-wrap;";
      article.append(body);
    }

    return article.outerHTML;
  }

  async function copyContent() {
    const plainText = title.trim() ? `${title.trim()}\n\n${content}` : content;
    const html = await createCopyHtml();

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } catch {
      const transfer = document.createElement("div");
      transfer.contentEditable = "true";
      transfer.style.cssText =
        "position:fixed;left:-99999px;top:0;width:520px;opacity:0;";
      transfer.innerHTML = html;
      document.body.append(transfer);
      const range = document.createRange();
      range.selectNodeContents(transfer);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("copy");
      selection?.removeAllRanges();
      transfer.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function savePreviewSelection() {
    const selection = window.getSelection();
    const body = previewBodyRef.current;
    if (!selection?.rangeCount || !body) return;
    const range = selection.getRangeAt(0);
    if (body.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }

  function insertImageInPreview(image: ArticleImage, atCaret: boolean) {
    const body = previewBodyRef.current;
    if (!body) return;

    const figure = document.createElement("figure");
    figure.dataset.imageId = image.id;
    figure.contentEditable = "false";

    const img = document.createElement("img");
    img.src = image.url;
    img.alt = image.name;

    const caption = document.createElement("figcaption");
    caption.textContent = image.name.replace(/\.[^.]+$/, "");

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "preview-remove-image";
    removeButton.dataset.removeImage = image.id;
    removeButton.setAttribute("aria-label", `删除图片 ${image.name}`);
    removeButton.textContent = "删除";

    figure.append(img, caption, removeButton);

    const range = atCaret ? savedRangeRef.current : null;
    if (range && body.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.insertNode(figure);
      range.setStartAfter(figure);
      range.collapse(true);
    } else {
      body.append(figure);
    }

    const spacer = document.createElement("div");
    spacer.append(document.createElement("br"));
    figure.after(spacer);

    const nextRange = document.createRange();
    nextRange.setStart(spacer, 0);
    nextRange.collapse(true);
    savedRangeRef.current = nextRange.cloneRange();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(nextRange);
  }

  function addImages(files: File[], atCaret = false) {
    const nextImages = files
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name || "粘贴的图片",
        url: URL.createObjectURL(file),
      }));

    if (nextImages.length) {
      setImages((current) => [...current, ...nextImages]);
      nextImages.forEach((image, index) => {
        insertImageInPreview(image, atCaret || index > 0);
      });
    }
  }

  function removeImage(id: string) {
    const target = images.find((image) => image.id === id);
    if (target) URL.revokeObjectURL(target.url);
    previewBodyRef.current
      ?.querySelectorAll<HTMLElement>("figure[data-image-id]")
      .forEach((figure) => {
        if (figure.dataset.imageId === id) {
          if (
            figure.nextElementSibling?.tagName === "DIV" &&
            figure.nextElementSibling.textContent === ""
          ) {
            figure.nextElementSibling.remove();
          }
          figure.remove();
        }
      });
    setImages((current) => current.filter((image) => image.id !== id));
  }

  useEffect(() => {
    if (
      previewTitleRef.current &&
      document.activeElement !== previewTitleRef.current &&
      previewTitleRef.current.innerText !== title
    ) {
      previewTitleRef.current.innerText = title;
    }
  }, [title]);

  useEffect(() => {
    if (
      previewBodyRef.current &&
      document.activeElement !== previewBodyRef.current &&
      !previewBodyRef.current.contains(document.activeElement) &&
      previewBodyRef.current.innerText !== content &&
      images.length === 0
    ) {
      previewBodyRef.current.innerText = content;
    }
  }, [content, images.length]);

  function pastePlainText(event: React.ClipboardEvent<HTMLElement>) {
    const pastedImages = Array.from(event.clipboardData.files).filter(
      (file) => file.type.startsWith("image/"),
    );

    if (pastedImages.length) {
      event.preventDefault();
      savePreviewSelection();
      addImages(pastedImages, true);
      return;
    }

    const text = event.clipboardData.getData("text/plain");
    if (text) {
      event.preventDefault();
      document.execCommand("insertText", false, text);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">字</span>
          <div>
            <strong>行间</strong>
            <span>中文文章预览器</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost-button" onClick={() => {
            setTitle(SAMPLE_TITLE);
            setContent(SAMPLE);
          }}>
            恢复示例
          </button>
          <button className="primary-button" onClick={copyContent}>
            {copied ? "图文已复制" : "复制全文"}
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="editor-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">EDITOR</p>
              <h1>把文章粘贴在这里</h1>
            </div>
            <span className="live-dot"><i />实时预览</span>
          </div>

          <label className="editor-label" htmlFor="title-input">
            文章标题
            <span>{titleCount} / {TITLE_LIMIT} · 空格不计</span>
          </label>
          <input
            id="title-input"
            className="title-input"
            aria-label="文章标题"
            value={title}
            onChange={(event) => setTitle(limitTitle(event.target.value))}
            placeholder="输入文章标题……"
          />

          <label className="editor-label body-label" htmlFor="article-input">
            正文内容
            <span>所有段落均左对齐</span>
          </label>
          <textarea
            id="article-input"
            aria-label="文章内容"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onPaste={(event) => {
              const pastedImages = Array.from(event.clipboardData.files).filter(
                (file) => file.type.startsWith("image/"),
              );
              if (pastedImages.length) {
                event.preventDefault();
                addImages(pastedImages);
              }
            }}
            onDrop={(event) => {
              const droppedImages = Array.from(event.dataTransfer.files).filter(
                (file) => file.type.startsWith("image/"),
              );
              if (droppedImages.length) {
                event.preventDefault();
                addImages(droppedImages);
              }
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) {
                event.preventDefault();
              }
            }}
            spellCheck={false}
            placeholder="粘贴你的文章，也可以直接粘贴或拖入图片……"
          />

          <div className="image-tools">
            <div>
              <strong>文章图片</strong>
              <span>支持粘贴、拖放或本地选择</span>
            </div>
            <button
              type="button"
              className="add-image-button"
              onClick={() => fileInputRef.current?.click()}
            >
              ＋ 添加图片
            </button>
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                addImages(
                  Array.from(event.target.files || []),
                  insertAtCaretRef.current,
                );
                insertAtCaretRef.current = false;
                event.target.value = "";
              }}
            />
          </div>

          {images.length > 0 && (
            <div className="image-list" aria-label="已添加的图片">
              {images.map((image, index) => (
                <div className="image-chip" key={image.id}>
                  {/* Blob URLs are local previews supplied by the user. */}
                  <img src={image.url} alt="" />
                  <span>{index + 1}. {image.name}</span>
                  <button
                    type="button"
                    aria-label={`删除图片 ${image.name}`}
                    onClick={() => removeImage(image.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="stats" aria-label="文章统计">
            <div><strong>{stats.characters}</strong><span>字数</span></div>
            <div><strong>{stats.paragraphs}</strong><span>段落</span></div>
            <div><strong>{stats.minutes}</strong><span>分钟阅读</span></div>
          </div>

          <div className="settings">
            <div className="setting-row">
              <label htmlFor="font-size">正文字号</label>
              <output>{fontSize}px</output>
              <input
                id="font-size"
                type="range"
                min="14"
                max="20"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
            </div>
            <div className="setting-row">
              <label htmlFor="line-height">行间距</label>
              <output>{lineHeight.toFixed(1)}</output>
              <input
                id="line-height"
                type="range"
                min="1.5"
                max="2.3"
                step="0.1"
                value={lineHeight}
                onChange={(event) => setLineHeight(Number(event.target.value))}
              />
            </div>
            <label className="toggle-row">
              <span>
                <b>显示行宽标尺</b>
                <small>检查目标句长是否保持一行</small>
              </span>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(event) => setShowGrid(event.target.checked)}
              />
              <i aria-hidden="true" />
            </label>
          </div>
        </aside>

        <section className="preview-panel">
          <div className="preview-heading">
            <div>
              <p className="eyebrow">PREVIEW</p>
              <h2>阅读效果</h2>
            </div>
            <span>手机版 · 390 × 844</span>
          </div>

          <div className="paper-wrap">
            <article
              className="paper"
              onDrop={(event) => {
                const droppedImages = Array.from(event.dataTransfer.files).filter(
                  (file) => file.type.startsWith("image/"),
                );
                if (droppedImages.length) {
                  event.preventDefault();
                  addImages(droppedImages);
                }
              }}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("Files")) {
                  event.preventDefault();
                }
              }}
              style={{
                "--body-size": `${fontSize}px`,
                "--body-leading": lineHeight,
              } as React.CSSProperties}
            >
              <div className="phone-status" aria-hidden="true">
                <span>9:41</span>
                <i />
                <span className="phone-signals">● ◒ ▰</span>
              </div>
              <div className="paper-meta">
                <span>文章预览</span>
                <span>{stats.minutes} MIN READ</span>
              </div>
              <h3
                ref={previewTitleRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="点击输入标题"
                aria-label="可编辑的文章标题"
                onInput={(event) => {
                  const limited = limitTitle(event.currentTarget.innerText);
                  if (event.currentTarget.innerText !== limited) {
                    event.currentTarget.innerText = limited;
                    const range = document.createRange();
                    range.selectNodeContents(event.currentTarget);
                    range.collapse(false);
                    const selection = window.getSelection();
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                  }
                  setTitle(limited);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                onPaste={pastePlainText}
              >
                {title}
              </h3>
              <div className="title-count">{titleCount} / {TITLE_LIMIT}</div>
              <div className="title-rule" />
              <div className="article-body">
                <div
                  ref={previewBodyRef}
                  className="article-copy"
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="点击这里直接输入或粘贴正文，也可以粘贴图片……"
                  aria-label="可编辑的文章正文"
                  onInput={(event) => {
                    const clone = event.currentTarget.cloneNode(true) as HTMLElement;
                    clone.querySelectorAll("figure").forEach((figure) => figure.remove());
                    setContent(clone.innerText);
                    savePreviewSelection();
                  }}
                  onPaste={pastePlainText}
                  onMouseUp={savePreviewSelection}
                  onKeyUp={savePreviewSelection}
                  onFocus={savePreviewSelection}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    const imageId = target.dataset.removeImage;
                    if (imageId) removeImage(imageId);
                  }}
                />
                <button
                  type="button"
                  className="preview-add-image"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertAtCaretRef.current = true;
                    fileInputRef.current?.click();
                  }}
                >
                  <span aria-hidden="true">＋</span>
                  <b>在光标处插入图片</b>
                  <small>先点击正文中的目标位置，再选择图片</small>
                </button>
              </div>
              {showGrid && (
                <div className="measure">
                  <div className="measure-label">
                    <span>单行硬上限 · {TARGET.length} 字符</span>
                    <span>目标句宽</span>
                  </div>
                  <p>{TARGET}</p>
                  <div className="ticks" aria-hidden="true" />
                </div>
              )}
              <footer className="paper-footer">
                <span>行间 · 中文文章预览器</span>
                <span>01</span>
              </footer>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
