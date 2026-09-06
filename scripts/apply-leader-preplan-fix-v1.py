from pathlib import Path

path = Path('js/admin-batch-calendar.js')
text = path.read_text()
text = text.replace(
    'function leaderDaySetCapacityScore(group, daySet, days, requiredFormation, salt)',
    'function leaderDaySetCapacityScore(group, daySet, days, requiredFormation, settings, salt)'
)
text = text.replace(
    'Number(settingsFromUi().minAntiMeta || 0)',
    'Number(settings.minAntiMeta || 0)'
)
text = text.replace(
    'leaderDaySetCapacityScore(group, left, days, requiredFormation, attemptSalt)',
    'leaderDaySetCapacityScore(group, left, days, requiredFormation, settings, attemptSalt)'
)
text = text.replace(
    'leaderDaySetCapacityScore(group, right, days, requiredFormation, attemptSalt)',
    'leaderDaySetCapacityScore(group, right, days, requiredFormation, settings, attemptSalt)'
)
text = text.replace(
    'leaderDaySetCapacityScore(group, daySet, days, requiredFormation, attemptSalt)',
    'leaderDaySetCapacityScore(group, daySet, days, requiredFormation, settings, attemptSalt)'
)
path.write_text(text)
