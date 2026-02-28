import { redirect } from 'next/navigation';

export default function ClientDetailRedirectPage() {
  redirect('/app/admin/customers');
}
