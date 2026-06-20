import UploadForm from '@/components/UploadForm';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="upload-page">
      <section className="upload-intro">
        <h1>Turn long-form media into moments you can use.</h1>
        <p>
          Upload up to 30 minutes of video or audio. ContextCast aligns every word,
          finds the strongest clips, and answers questions at the exact moment they matter.
        </p>
      </section>
      <UploadForm />
      <Link href="/demo" className="demo-link">Open the sample workspace</Link>
      <div className="workflow-line" aria-label="Analysis workflow">
        <span>Whisper alignment</span><i />
        <span>Multimodal analysis</span><i />
        <span>Hybrid temporal search</span>
      </div>
    </div>
  );
}
