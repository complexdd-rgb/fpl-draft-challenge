/* Shared prompt helper functions. */
window.FPL_V3_HELPERS = {
  hasManager: (seasonRecord, managerName) =>
    Array.isArray(seasonRecord?.managers) &&
    seasonRecord.managers.some(m => m.toLowerCase() === managerName.toLowerCase()),
  isChampion: seasonRecord => seasonRecord?.champions === true,
  isTopFour: seasonRecord => seasonRecord?.topFour === true,
  isBottomHalf: seasonRecord => seasonRecord?.bottomHalf === true,
  isRelegated: seasonRecord => seasonRecord?.relegated === true,
  isPromoted: seasonRecord => seasonRecord?.promoted === true,
  ageBetween: (seasonRecord, minimum, maximum) =>
    Number.isFinite(seasonRecord?.ageAtSeasonStart) &&
    seasonRecord.ageAtSeasonStart >= minimum &&
    seasonRecord.ageAtSeasonStart <= maximum
};
