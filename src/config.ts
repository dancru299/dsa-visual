export const REPO_URL = 'https://github.com/dancru299/dsa-visual';

// Link góp ý ở cuối mỗi bài: mở một issue mới trên GitHub, điền sẵn tên bài.
export const feedbackUrl = (lessonTitle: string) =>
  `${REPO_URL}/issues/new?${new URLSearchParams({ title: `Góp ý: ${lessonTitle}` })}`;
