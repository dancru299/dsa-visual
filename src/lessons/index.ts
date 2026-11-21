import type { Lesson } from '@/src/engine/types';
import { bigOLesson } from './big-o/lesson';
import { binarySearchLesson } from './binary-search/lesson';
import { hashTableLesson } from './hash-table/lesson';
import { mergeSortLesson } from './merge-sort/lesson';
import { queueLesson } from './queue/lesson';
import { stackLesson } from './stack/lesson';

// Nội dung chạy trên trình duyệt của các bài đã làm. Khớp với các bài built: true trong catalog.ts.
export const LESSONS: Record<string, Lesson> = {
  [bigOLesson.slug]: bigOLesson,
  [binarySearchLesson.slug]: binarySearchLesson,
  [stackLesson.slug]: stackLesson,
  [queueLesson.slug]: queueLesson,
  [hashTableLesson.slug]: hashTableLesson,
  [mergeSortLesson.slug]: mergeSortLesson,
};
