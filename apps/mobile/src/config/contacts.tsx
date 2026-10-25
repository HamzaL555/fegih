import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Contact shortcuts shown in the Contacts screen.
 *
 * Replace the four values below (phone, instagram, tiktok, website) with the
 * real accounts — nothing else needs to change.
 *
 * The icons are drawn as inline SVG rather than pulled from an icon font:
 * `@expo/vector-icons` is not a dependency, and TikTok is not part of the free
 * FontAwesome sets anyway.
 */

const BRAND = {
  phone: '#0E9E6E',
  instagram: '#E1306C',
  tiktok: '#FE2C55',
  website: '#2563EB',
} as const;

export type ContactKind = 'phone' | 'link' | 'email';

export interface Contact {
  id: string;
  labelKey: string;
  kind: ContactKind;
  value: string;
  url: string;
  display: string;
  color: string;
  Icon: (props: { color: string; size: number }) => React.JSX.Element;
}

export const CONTACT_VALUES = {
  /** e.g. +994501234567 — digits and a leading + are enough. */
  phone: '+994 50 123 45 67',
  instagram: 'https://instagram.com/fegih.az',
  tiktok: 'https://tiktok.com/@fegih.az',
  website: 'https://fegih.az',
} as const;

/* Brand marks: simple-icons paths, scaled by the parent viewBox. */

function PhoneIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function InstagramIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.9.422.422.681.818.9 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.9 1.382-.419.419-.824.681-1.38.9-.42.164-1.065.36-2.235.412-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.9-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.846-10.405a1.441 1.441 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z"
        fill={color}
      />
    </Svg>
  );
}

function TikTokIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
        fill={color}
      />
    </Svg>
  );
}

function WebsiteIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      <Path d="M2 12h20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        stroke={color}
        strokeWidth={2}
      />
    </Svg>
  );
}

export const APP_SOCIALS: Contact[] = [
  {
    id: 'phone',
    labelKey: 'contacts.phone',
    kind: 'phone',
    value: CONTACT_VALUES.phone,
    url: `tel:${CONTACT_VALUES.phone.replace(/\s/g, '')}`,
    display: CONTACT_VALUES.phone,
    color: BRAND.phone,
    Icon: PhoneIcon,
  },
  {
    id: 'instagram',
    labelKey: 'contacts.instagram',
    kind: 'link',
    value: CONTACT_VALUES.instagram,
    url: CONTACT_VALUES.instagram,
    display: '@fegih.az',
    color: BRAND.instagram,
    Icon: InstagramIcon,
  },
  {
    id: 'tiktok',
    labelKey: 'contacts.tiktok',
    kind: 'link',
    value: CONTACT_VALUES.tiktok,
    url: CONTACT_VALUES.tiktok,
    display: '@fegih.az',
    color: BRAND.tiktok,
    Icon: TikTokIcon,
  },
  {
    id: 'website',
    labelKey: 'contacts.website',
    kind: 'link',
    value: CONTACT_VALUES.website,
    url: CONTACT_VALUES.website,
    display: 'fegih.az',
    color: BRAND.website,
    Icon: WebsiteIcon,
  },
];
