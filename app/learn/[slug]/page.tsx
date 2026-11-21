import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LessonView } from '@/src/components/LessonView';
import { BUILT_LESSONS, findLesson } from '@/src/lessons/catalog';

// Mỗi bài đã làm là một trang tĩnh, sinh lúc build.
export function generateStaticParams() {
  return BUILT_LESSONS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<'/learn/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const lesson = findLesson(slug);
  return lesson ? { title: lesson.title, description: lesson.summary } : {};
}

export default async function LessonPage({ params }: PageProps<'/learn/[slug]'>) {
  const { slug } = await params;
  const lesson = findLesson(slug);
  // Cache Components không cho dùng dynamicParams = false, nên slug lạ được trả 404 ở đây.
  if (!lesson) notFound();
  return <LessonView meta={lesson} />;
}
