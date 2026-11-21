import type { Lesson } from '@/src/engine/types';
import { bigOLesson } from './big-o/lesson';
import { bstLesson } from './binary-search-tree/lesson';
import { bfsDfsLesson } from './bfs-dfs/lesson';
import { binarySearchLesson } from './binary-search/lesson';
import { bloomLesson } from './bloom-filter/lesson';
import { btreeLesson } from './b-tree/lesson';
import { hashTableLesson } from './hash-table/lesson';
import { heapLesson } from './heap/lesson';
import { mergeSortLesson } from './merge-sort/lesson';
import { queueLesson } from './queue/lesson';
import { stackLesson } from './stack/lesson';
import { topologicalSortLesson } from './topological-sort/lesson';
import { unionFindLesson } from './union-find/lesson';

// Nội dung chạy trên trình duyệt của các bài đã làm. Khớp với các bài built: true trong catalog.ts.
export const LESSONS: Record<string, Lesson> = {
  [bigOLesson.slug]: bigOLesson,
  [binarySearchLesson.slug]: binarySearchLesson,
  [stackLesson.slug]: stackLesson,
  [queueLesson.slug]: queueLesson,
  [hashTableLesson.slug]: hashTableLesson,
  [mergeSortLesson.slug]: mergeSortLesson,
  [heapLesson.slug]: heapLesson,
  [bstLesson.slug]: bstLesson,
  [btreeLesson.slug]: btreeLesson,
  [bfsDfsLesson.slug]: bfsDfsLesson,
  [topologicalSortLesson.slug]: topologicalSortLesson,
  [bloomLesson.slug]: bloomLesson,
  [unionFindLesson.slug]: unionFindLesson,
};
