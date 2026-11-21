import { BUILT_LESSONS } from '@/src/lessons/catalog';
import { OG_SIZE, ogImage } from '@/src/og';
import { SITE_DESCRIPTION } from '@/src/site';

export const alt = 'DSA Visual: học cấu trúc dữ liệu và giải thuật bằng animation';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogImage({
    kicker: 'HỌC DSA BẰNG ANIMATION',
    title: 'DSA Visual',
    summary: SITE_DESCRIPTION,
    chips: [`${BUILT_LESSONS.length} bài`, 'Câu đoán', 'Quiz'],
  });
}
