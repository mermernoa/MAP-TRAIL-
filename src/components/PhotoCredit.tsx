interface Props {
  credit: string;
  /** Lien de la photo, tel que noté dans la feuille. */
  src: string;
  className?: string;
}

/** Crédit d'une photo, avec le lien vers l'image d'origine. */
export function PhotoCredit({ credit, src, className = '' }: Props) {
  return (
    <p className={`photo-credit ${className}`}>
      Photo :{' '}
      <a href={src} target="_blank" rel="noreferrer">
        {credit}
      </a>
    </p>
  );
}
