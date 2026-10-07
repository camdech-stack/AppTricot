// Short French greeting for the home header, by local hour.
export function getGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'Bonjour'
  if (hour >= 12 && hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}
