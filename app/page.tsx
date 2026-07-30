"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SAMPLE_TITLE = "AI 加速了科学，也在掏空大学是不是是不是";

const SAMPLE = `真正的变化，往往不是从一声巨响开始的。

它先出现在一些微小的瞬间：一段更像人的回答，一次不再需要反复修改的协作，一项昨天还被认为不可能完成的任务。

当能力的边界继续向前，写作者真正需要的，也许不是更快地产出，而是重新拿回对节奏、判断与表达的控制。`;

const TARGET = "过去几年，他们负责把 AI 推向更高的能力边界";
const TITLE_LINE_LIMIT = 20;
const TITLE_TOTAL_LIMIT = 64;

type ArticleImage = {
  id: string;
  name: string;
  url: string;
};

type ProofreadIssue = {
  end: number;
  message: string;
  start: number;
};

function formatReadTime(count: number) {
  return Math.max(1, Math.ceil(count / 400));
}

function countTitleCharacters(value: string) {
  return Array.from(value).filter((character) => !/\s/u.test(character)).length;
}

function limitTitle(value: string) {
  const normalized = value.replace(/\r/g, "");
  let totalCount = 0;
  let lineCount = 0;
  let result = "";

  for (const character of Array.from(normalized)) {
    if (character === "\n") {
      if (!result.endsWith("\n")) result += "\n";
      lineCount = 0;
      continue;
    }

    if (!/\s/u.test(character)) {
      if (totalCount >= TITLE_TOTAL_LIMIT) break;
      if (lineCount >= TITLE_LINE_LIMIT) {
        result += "\n";
        lineCount = 0;
      }
      totalCount += 1;
      lineCount += 1;
    }
    result += character;
  }

  return result;
}

export default function Home() {
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [content, setContent] = useState(SAMPLE);
  const [feishuUrl, setFeishuUrl] = useState("");
  const [importState, setImportState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [importMessage, setImportMessage] = useState("");
  const [fontSize, setFontSize] = useState(15);
  const [lineHeight, setLineHeight] = useState(1.85);
  const [showGrid, setShowGrid] = useState(true);
  const [copied, setCopied] = useState(false);
  const [proofreadActive, setProofreadActive] = useState(false);
  const [proofreadCount, setProofreadCount] = useState(0);
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
          try {
            const blob = await fetch(image.src).then((response) => response.blob());
            image.src = await blobToDataUrl(blob);
          } catch {
            // Keep a public remote URL when its image host blocks CORS.
          }
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
    if (target?.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
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

  function cleanMarkdownText(markdown: string) {
    return markdown
      .replace(/\u200b/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, "• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function importFeishuDocument(inputUrl: string) {
    const trimmedUrl = inputUrl.trim();

    try {
      const parsedUrl = new URL(trimmedUrl);
      if (
        !parsedUrl.hostname.endsWith(".feishu.cn") ||
        !/^\/(wiki|docx)\//.test(parsedUrl.pathname)
      ) {
        throw new Error("请粘贴公开的飞书文档或知识库链接");
      }

      setImportState("loading");
      setImportMessage("正在读取公开文档……");

      const response = await fetch(`https://r.jina.ai/${trimmedUrl}`);
      if (!response.ok) throw new Error(`读取失败（${response.status}）`);

      const raw = await response.text();
      const marker = "Markdown Content:";
      const markerIndex = raw.indexOf(marker);
      const markdown = markerIndex >= 0
        ? raw.slice(markerIndex + marker.length).trim()
        : raw.trim();
      if (!markdown) throw new Error("没有读取到文档内容");

      const imagePattern =
        /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
      const importedImages: ArticleImage[] = [];
      const pieces: Array<
        { type: "text"; value: string } |
        { type: "image"; image: ArticleImage }
      > = [];
      let cursor = 0;

      for (const match of markdown.matchAll(imagePattern)) {
        const index = match.index ?? 0;
        if (index > cursor) {
          pieces.push({ type: "text", value: markdown.slice(cursor, index) });
        }
        const image: ArticleImage = {
          id: `feishu-${crypto.randomUUID()}`,
          name: match[1]?.trim() || `飞书图片 ${importedImages.length + 1}`,
          url: match[2],
        };
        importedImages.push(image);
        pieces.push({ type: "image", image });
        cursor = index + match[0].length;
      }
      if (cursor < markdown.length) {
        pieces.push({ type: "text", value: markdown.slice(cursor) });
      }

      const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
      if (firstHeading) setTitle(limitTitle(firstHeading));

      const plainContent = cleanMarkdownText(markdown.replace(imagePattern, "\n"));
      setContent(plainContent);
      setImages((current) => {
        current.forEach((image) => {
          if (image.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
        });
        return importedImages;
      });

      const body = previewBodyRef.current;
      if (body) {
        body.replaceChildren();
        for (const piece of pieces) {
          if (piece.type === "image") {
            insertImageInPreview(piece.image, false);
          } else {
            const text = cleanMarkdownText(piece.value);
            if (text) {
              if (body.childNodes.length) body.append("\n\n");
              body.append(document.createTextNode(text));
            }
          }
        }
      }

      setImportState("success");
      setImportMessage(
        `已导入 ${plainContent.replace(/\s/g, "").length} 字、${importedImages.length} 张图片`,
      );
    } catch (error) {
      setImportState("error");
      setImportMessage(
        error instanceof Error ? error.message : "飞书文档读取失败",
      );
    }
  }

  function findChineseWritingIssues(
    text: string,
    duplicateSegments: string[] = [],
  ) {
    const issues: ProofreadIssue[] = [];
    const addMatches = (pattern: RegExp, message: string) => {
      for (const match of text.matchAll(pattern)) {
        if (match.index === undefined) continue;
        issues.push({
          start: match.index,
          end: match.index + match[0].length,
          message,
        });
      }
    };
    const addBoundaryMatches = (pattern: RegExp, message: string) => {
      for (const match of text.matchAll(pattern)) {
        if (match.index === undefined) continue;
        const boundaryCharacter = match.index + Math.max(0, match[0].length - 1);
        issues.push({
          start: boundaryCharacter,
          end: boundaryCharacter + 1,
          message,
        });
      }
    };

    addMatches(/[,!?;:'()[\]]/g, "请使用对应的中文全角标点");
    addMatches(/(?<!\d)\.(?!\d)/g, "句号请使用“。”；省略号请使用“……”");
    addMatches(/\.{2,}/g, "中文省略号应写作“……”");
    addMatches(/-{2,}/g, "中文破折号应写作“——”");
    addMatches(/[＂"]/g, "请成对使用上引号“和下引号”");
    addBoundaryMatches(
      /\p{Script=Han}\p{Script=Latin}/gu,
      "中文与英文之间应增加空格",
    );
    addBoundaryMatches(
      /\p{Script=Latin}\p{Script=Han}/gu,
      "英文与中文之间应增加空格",
    );
    addBoundaryMatches(/\p{Script=Han}[0-9]/gu, "中文与数字之间应增加空格");
    addBoundaryMatches(/[0-9]\p{Script=Han}/gu, "数字与中文之间应增加空格");
    addMatches(/([，。！？；：])\1+/g, "正式中文通常不连续使用相同标点");
    addMatches(/[ \t]+[，。！？；：、）》】”]/g, "中文标点前不应留空格");
    addMatches(/[（《【“][ \t]+/g, "中文前置标点后不应留空格");

    const commonTypos: Array<[RegExp, string]> = [
      [/做为/g, "“做为”通常应改为“作为”"],
      [/帐号/g, "按现行规范，建议使用“账号”"],
      [/登陆/g, "表示进入系统时，建议使用“登录”"],
      [/截止目前/g, "建议改为“截至目前”"],
      [/既使/g, "“既使”应改为“即使”"],
      [/按装/g, "“按装”应改为“安装”"],
      [/再接再励/g, "“再接再励”应改为“再接再厉”"],
      [/名符其实/g, "“名符其实”应改为“名副其实”"],
      [/迫不急待/g, "“迫不急待”应改为“迫不及待”"],
      [/一如即往/g, "“一如即往”应改为“一如既往”"],
    ];
    commonTypos.forEach(([pattern, message]) => addMatches(pattern, message));

    const grammarRisks: Array<[RegExp, string]> = [
      [/原因是因为/g, "“原因是因为”语义重复，建议使用“原因是”或“因为”"],
      [/目的是为了/g, "“目的”和“为了”语义重复，建议删去一个"],
      [/大约[^，。！？\n]{0,12}左右/g, "“大约”和“左右”语义重复，建议保留一个"],
      [/近[^，。！？\n]{0,12}左右/g, "“近”和“左右”表达冲突，建议核对"],
      [/超过[^，。！？\n]{0,12}以上/g, "“超过”和“以上”语义重复，建议保留一个"],
      [/不足[^，。！？\n]{0,12}以下/g, "“不足”和“以下”语义重复，建议保留一个"],
      [/是否[^。！？\n]{0,30}吗[？?]?/g, "“是否”和“吗”不宜同时使用"],
      [/防止[^。！？\n]{0,30}不/g, "可能存在否定不当，请核对“防止”和“不”的搭配"],
      [/避免[^。！？\n]{0,30}不/g, "可能存在否定不当，请核对“避免”和“不”的搭配"],
      [/通过[^。！？\n]{2,40}，?使[^。！？\n]{2,40}/g, "“通过……使……”可能造成句子缺少主语，建议核对"],
      [/凯旋归来/g, "“凯旋”已包含归来的意思，可改为“凯旋”"],
      [/提前预先/g, "“提前”和“预先”语义重复"],
      [/免费赠送/g, "“赠送”通常已含免费之意，建议核对"],
      [/共同协商/g, "“协商”通常已含共同参与之意，建议精简"],
      [/亲眼目睹/g, "“目睹”已含亲眼看见之意，建议精简"],
    ];
    grammarRisks.forEach(([pattern, message]) => addMatches(pattern, message));

    addMatches(
      /([\u3400-\u9fffA-Za-z0-9]{2,12})(?:[，、\s]*)\1/g,
      "发现连续重复的词语或表述，请确认是否需要删减",
    );
    addMatches(
      /(的的|了了|是是|在在|以及以及|但是但是|因为因为|所以所以)/g,
      "发现疑似重复用词",
    );

    duplicateSegments.forEach((segment) => {
      const escaped = segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      addMatches(
        new RegExp(escaped, "g"),
        segment.includes("\n") || segment.length > 80
          ? "发现重复段落，请确认是否需要删除"
          : "发现重复句子或表述，请确认是否需要删减",
      );
    });

    for (const sentence of text.matchAll(/[^。！？\n]+[。！？]?/g)) {
      if (
        sentence.index !== undefined &&
        sentence[0].replace(/\s/g, "").length > 120
      ) {
        issues.push({
          start: sentence.index,
          end: sentence.index + sentence[0].length,
          message: "句子较长，建议检查主谓搭配并考虑拆分",
        });
      }
    }

    return issues;
  }

  function findDuplicateSegments() {
    const candidates = [
      ...content.split(/\n\s*\n/).map((item) => item.trim()),
      ...content
        .split(/(?<=[。！？])/)
        .map((item) => item.trim()),
    ].filter((item) => item.replace(/\s/g, "").length >= 8);
    const counts = new Map<string, number>();
    candidates.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
    return Array.from(counts)
      .filter(([, count]) => count > 1)
      .map(([item]) => item)
      .sort((a, b) => b.length - a.length);
  }

  function clearProofreadMarks() {
    [previewTitleRef.current, previewBodyRef.current].forEach((root) => {
      if (!root) return;
      root.querySelectorAll("mark[data-proofread]").forEach((mark) => {
        mark.replaceWith(document.createTextNode(mark.textContent || ""));
      });
      root.normalize();
    });
  }

  function applyProofreadMarks() {
    const roots = [previewTitleRef.current, previewBodyRef.current]
      .filter((root): root is HTMLElement => Boolean(root));
    if (!roots.length) return 0;

    clearProofreadMarks();
    const duplicateSegments = findDuplicateSegments();
    const textNodes: Text[] = [];
    roots.forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        const parent = current.parentElement;
        if (
          current.textContent?.trim() &&
          !parent?.closest("figure, button, figcaption")
        ) {
          textNodes.push(current as Text);
        }
        current = walker.nextNode();
      }
    });

    let total = 0;
    textNodes.forEach((node) => {
      const text = node.data;
      const rawIssues = findChineseWritingIssues(text, duplicateSegments)
        .sort((a, b) => a.start - b.start || b.end - a.end);
      const issues: ProofreadIssue[] = [];
      rawIssues.forEach((issue) => {
        const previous = issues.at(-1);
        if (!previous || issue.start >= previous.end) issues.push(issue);
      });
      if (!issues.length) return;

      const fragment = document.createDocumentFragment();
      let cursor = 0;
      issues.forEach((issue) => {
        if (issue.start > cursor) {
          fragment.append(document.createTextNode(text.slice(cursor, issue.start)));
        }
        const mark = document.createElement("mark");
        mark.dataset.proofread = "true";
        mark.title = issue.message;
        mark.textContent = text.slice(issue.start, issue.end);
        fragment.append(mark);
        cursor = issue.end;
        total += 1;
      });
      if (cursor < text.length) {
        fragment.append(document.createTextNode(text.slice(cursor)));
      }
      node.replaceWith(fragment);
    });

    return total;
  }

  function toggleProofread() {
    if (proofreadActive) {
      clearProofreadMarks();
      setProofreadActive(false);
      setProofreadCount(0);
      return;
    }

    setProofreadActive(true);
    window.requestAnimationFrame(() => {
      setProofreadCount(applyProofreadMarks());
    });
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
          <button
            className={`proofread-button ${proofreadActive ? "active" : ""}`}
            onClick={toggleProofread}
          >
            {proofreadActive ? `取消校对 · ${proofreadCount}` : "中文校对"}
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

          <label className="editor-label" htmlFor="feishu-link">
            飞书公开链接
            <span>粘贴后自动导入</span>
          </label>
          <div className="feishu-import">
            <input
              id="feishu-link"
              type="url"
              value={feishuUrl}
              onChange={(event) => {
                setFeishuUrl(event.target.value);
                if (importState !== "idle") setImportState("idle");
              }}
              onPaste={(event) => {
                const pastedUrl = event.clipboardData.getData("text").trim();
                if (pastedUrl) {
                  event.preventDefault();
                  setFeishuUrl(pastedUrl);
                  void importFeishuDocument(pastedUrl);
                }
              }}
              placeholder="粘贴 ifanr.feishu.cn/wiki/…"
              aria-label="飞书公开文档链接"
            />
            <button
              type="button"
              disabled={!feishuUrl.trim() || importState === "loading"}
              onClick={() => void importFeishuDocument(feishuUrl)}
            >
              {importState === "loading" ? "读取中" : "导入"}
            </button>
          </div>
          <p className={`import-message ${importState}`}>
            {importMessage || "仅支持互联网上获得链接的人可阅读的飞书文档"}
          </p>

          <label className="editor-label" htmlFor="title-input">
            文章标题
            <span>{titleCount} / {TITLE_TOTAL_LIMIT} · 每行 {TITLE_LINE_LIMIT}</span>
          </label>
          <textarea
            id="title-input"
            className="title-input"
            aria-label="文章标题"
            value={title}
            onChange={(event) => setTitle(limitTitle(event.target.value))}
            placeholder="输入文章标题，可分多行……"
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
          {proofreadActive && (
            <div className="proofread-legend">
              <i />黄色标记为待检查项，悬停可查看修改建议
            </div>
          )}

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
                contentEditable={!proofreadActive}
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
                onPaste={pastePlainText}
              >
                {title}
              </h3>
              <div className="title-count">
                {titleCount} / {TITLE_TOTAL_LIMIT} · 每行最多 {TITLE_LINE_LIMIT}
              </div>
              <div className="title-rule" />
              <div className="article-body">
                <div
                  ref={previewBodyRef}
                  className="article-copy"
                  contentEditable={!proofreadActive}
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
                  disabled={proofreadActive}
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
