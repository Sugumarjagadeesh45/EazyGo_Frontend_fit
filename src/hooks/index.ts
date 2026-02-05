/**
 * Hooks barrel export
 */

export { useDeepLink, parseDeepLink } from './useDeepLink';
export type { DeepLinkParams, DeepLinkResult } from './useDeepLink';

export { useStravaAppLink } from './useStravaAppLink';
export type {
  StravaLinkState,
  StravaLinkResult,
  UseStravaAppLinkReturn,
} from './useStravaAppLink';

export {
  useAthleteData,
  formatDistance,
  formatDuration,
  formatDate,
  formatPace,
  getActivityIcon,
  getActivityColor,
} from './useAthleteData';
export type {
  AthleteData,
  UseAthleteDataReturn,
} from './useAthleteData';
