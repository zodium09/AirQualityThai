import { Wind } from 'lucide-react';

export default function LoadingScreen({ title = 'กำลังโหลดข้อมูล', subtitle = 'ใช้เวลาไม่นาน' }) {
  return (
    <div aria-live="polite" className="loading-state" role="status">
      <span aria-hidden="true" className="loading-state__mark"><Wind size={25} /></span>
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </div>
  );
}
