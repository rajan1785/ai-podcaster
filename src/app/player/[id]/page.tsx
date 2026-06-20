import PlayerContainer from '@/components/PlayerContainer';
import { getJob } from '@/lib/job-store';
import Link from 'next/link';

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Note: Since this is an in-memory queue for prototype, 
  // if the server restarts, this will be undefined.
  // In a real app we would fetch from DB.
  // But for the sake of demo, if not found, we'll just pass the ID and the client can handle or show error.
  const job = await getJob(id);

  if (!job) {
    // Return a graceful error or mock data if we lost in-memory state during dev
    return (
      <div style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h2>Session Expired or Not Found</h2>
        <p>Please upload your video again.</p>
        <Link href="/" className="header-action" style={{ display: 'inline-block', marginTop: '1rem' }}>Go back</Link>
      </div>
    );
  }

  return (
    <PlayerContainer 
      jobId={id} 
      videoUrl={`/api/media/${id}`}
      fileName={job.fileName}
      result={job.result} 
    />
  );
}
