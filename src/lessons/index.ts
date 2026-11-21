import type { Lesson } from '@/src/engine/types';
import { bigOLesson } from './big-o/lesson';
import { binarySearchLesson } from './binary-search/lesson';
import { stackLesson } from './stack/lesson';

// Nội dung chạy trên trình duyệt của các bài đã làm. Khớp với các bài built: true trong catalog.ts.
export const LESSONS: Record<string, Lesson> = {
  [bigOLesson.slug]: bigOLesson,
  [binarySearchLesson.slug]: binarySearchLesson,
  [stackLesson.slug]: stackLesson,
};
