import { entryId } from '../lib/season';
import { useSeasonStore } from '../store/season';
import { CheckIcon, PlusIcon } from './Icons';

interface Props {
  eventId: string;
  courseId: string;
  courseName?: string;
  compact?: boolean;
}

/** Ajoute ou retire un parcours de « Ma saison ». */
export function SeasonToggle({ eventId, courseId, courseName, compact = false }: Props) {
  const id = entryId(eventId, courseId);
  const inSeason = useSeasonStore((s) => s.entries.some((e) => e.id === id));
  const add = useSeasonStore((s) => s.add);
  const remove = useSeasonStore((s) => s.remove);
  const label = inSeason ? 'Dans ma saison' : compact ? 'Ma saison' : 'Ajouter à ma saison';
  return (
    <button
      type="button"
      className={`season-toggle ${inSeason ? 'is-on' : ''} ${compact ? 'is-compact' : ''}`}
      aria-pressed={inSeason}
      aria-label={
        courseName ? `${inSeason ? 'Retirer' : 'Ajouter'} ${courseName} ${inSeason ? 'de' : 'à'} ma saison` : undefined
      }
      title={inSeason ? 'Retirer de ma saison' : 'Ajouter à ma saison'}
      onClick={(e) => {
        e.stopPropagation();
        if (inSeason) remove(id);
        else add(eventId, courseId);
      }}
    >
      {inSeason ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
      <span>{label}</span>
    </button>
  );
}
