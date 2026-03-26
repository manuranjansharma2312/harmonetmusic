import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface TutorialContentProps {
  html: string;
  className?: string;
}

function getYouTubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace('www.', '');

    if (hostname === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (url.pathname.startsWith('/embed/')) {
        return `https://www.youtube.com${url.pathname}`;
      }

      if (url.pathname.startsWith('/shorts/')) {
        const id = url.pathname.split('/').filter(Boolean)[1];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeTutorialHtml(html: string) {
  if (!html || typeof window === 'undefined') return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLDivElement | null;

  if (!root) return html;

  const replaceWithIframe = (element: Element, source: string) => {
    const embedUrl = getYouTubeEmbedUrl(source);
    if (!embedUrl) return;

    const iframe = doc.createElement('iframe');
    iframe.setAttribute('src', embedUrl);
    iframe.setAttribute('title', 'Embedded tutorial video');
    iframe.setAttribute('class', 'ql-video');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    );

    element.replaceWith(iframe);
  };

  root.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href')?.trim();
    if (href) replaceWithIframe(anchor, href);
  });

  root.querySelectorAll('p').forEach((paragraph) => {
    if (paragraph.children.length > 0) return;

    const text = paragraph.textContent?.trim();
    if (text) replaceWithIframe(paragraph, text);
  });

  return root.innerHTML;
}

export function TutorialContent({ html, className }: TutorialContentProps) {
  const normalizedHtml = useMemo(() => {
    const processed = normalizeTutorialHtml(html);
    return DOMPurify.sanitize(processed, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'src', 'referrerpolicy'],
    });
  }, [html]);

  return (
    <div
      className={cn('tutorial-content max-w-none overflow-x-hidden break-words text-foreground', className)}
      dangerouslySetInnerHTML={{ __html: normalizedHtml }}
    />
  );
}
