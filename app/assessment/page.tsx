import type { Metadata } from 'next';
import SubpageLayout from '@/components/SubpageLayout';
import AssessmentClient from './AssessmentClient';

export const metadata: Metadata = {
  title: 'Workload assessment',
  description:
    'One workload, up to 20 of your own tasks, three candidate models, a decision report in seven business days. $490, credited against an annual plan.',
  alternates: { canonical: '/assessment' },
};

export default function AssessmentPage() {
  return (
    <SubpageLayout>
      <AssessmentClient />
    </SubpageLayout>
  );
}
