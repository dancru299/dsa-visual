import { BUILT_LESSONS, findLesson } from '@/src/lessons/catalog';
import { OG_SIZE, ogImage } from '@/src/og';

export const alt = 'Bài học trên DSA Visual';
export const size = OG_SIZE;
export const contentType = 'image/png';

// Vẽ sẵn ảnh cho mọi bài lúc build, giống chính trang bài.
export function generateStaticParams() {
  return BUILT_LESSONS.map((l) => ({ slug: l.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = findLesson(slug);
  return ogImage({
    kicker: lesson ? lesson.module.name.toUpperCase() : 'DSA VISUAL',
    title: lesson?.title ?? 'DSA Visual',
    summary: lesson?.summary ?? '',
    chips: lesson ? [`${lesson.minutes} phút`, lesson.level ?? ''].filter(Boolean) : [],
  });
}
