interface PlaybackControlsProps {
  isPlaying: boolean;
  speed: number;
  isLooping: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onCycleSpeed: () => void;
  onToggleLoop: () => void;
}

export function PlaybackControls({
  isPlaying,
  speed,
  isLooping,
  onTogglePlay,
  onRestart,
  onCycleSpeed,
  onToggleLoop,
}: PlaybackControlsProps) {
  return (
    <div className="playback-controls">
      <button
        className={`playback-controls__btn ${isPlaying ? 'playback-controls__btn--active' : ''}`}
        onClick={onTogglePlay}
        title="Play/Pause (Space)"
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <button
        className="playback-controls__btn"
        onClick={onRestart}
        title="Restart (R)"
      >
        ↺
      </button>
      <button
        className="playback-controls__btn"
        onClick={onCycleSpeed}
        title="Speed"
      >
        {speed}x
      </button>
      <button
        className={`playback-controls__btn ${isLooping ? 'playback-controls__btn--active' : ''}`}
        onClick={onToggleLoop}
        title="Loop"
      >
        ↻
      </button>
    </div>
  );
}
