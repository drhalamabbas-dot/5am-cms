/* أيقونة تُرسم كـ <svg> مباشرة، بلا عنصر غلاف.

   الغلاف كان يضيف <span> بين الزر والأيقونة، فتختلف شجرة العناصر عن الموقع
   القديم وتتأثر قواعد CSS التي تخاطب الابن المباشر. */
import { icoParts, ico } from '@/lib/icons';

export function Icon({ name, ...rest }: { name: string } & Record<string, any>) {
  const part = icoParts[name];
  if (!part) {
    const raw = (ico as Record<string, string>)[name];
    return raw ? <span dangerouslySetInnerHTML={{ __html: raw }} /> : null;
  }
  return <svg {...part.attrs} {...rest} dangerouslySetInnerHTML={{ __html: part.inner }} />;
}
