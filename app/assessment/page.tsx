import type { Metadata } from 'next';
import SubpageLayout from '@/components/SubpageLayout';
import AssessmentClient from './AssessmentClient';
import '../../styles/docs.css';

export const metadata: Metadata = {
  title: 'Workload assessment',
  description:
    'One workload, up to 20 of your own tasks, three candidate models, a decision report in seven business days. $1,290, fully refunded if we cannot measure your workload, and credited against an annual plan.',
  alternates: { canonical: '/assessment' },
};

export default function AssessmentPage({ searchParams }: { searchParams?: { cancelled?: string } }) {
  return (
    <SubpageLayout>
      <AssessmentClient cancelled={searchParams?.cancelled === '1'} />
    </SubpageLayout>
  );
}
