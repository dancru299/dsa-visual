import { LearnShell } from '@/src/components/LearnShell';
import { Sidebar } from '@/src/components/Sidebar';

export default function LearnLayout({ children }: LayoutProps<'/learn'>) {
  return <LearnShell sidebar={<Sidebar />}>{children}</LearnShell>;
}
