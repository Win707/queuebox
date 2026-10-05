export function getTrackScore(track) {
  return Object.values(track.votes).reduce((total, vote) => total + vote, 0);
}

export function sortQueueByScore(queue) {
  return queue
    .map((track, index) => ({ track, index }))
    .sort((left, right) => getTrackScore(right.track) - getTrackScore(left.track) || left.index - right.index)
    .map(({ track }) => track);
}
