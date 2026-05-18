import { useState, useRef, useCallback, useEffect } from 'react';

export interface PlaybackState {
  currentStepIndex: number;
  isPlaying: boolean;
  speed: number;
  isLooping: boolean;
}

export interface PlaybackControls {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  restart: () => void;
  cycleSpeed: () => void;
  toggleLoop: () => void;
  jumpToStep: (index: number) => void;
}

export function usePlayback(totalSteps: number): [PlaybackState, PlaybackControls] {
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // auto-advance effect: runs whenever playing state or step changes
  useEffect(() => {
    if (!isPlaying) return;

    timerRef.current = setTimeout(() => {
      setCurrentStepIndex((prev) => {
        const next = prev + 1;
        if (next >= totalSteps) {
          if (isLooping) {
            return 0;
          }
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 1500 / speed);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, currentStepIndex, speed, isLooping, totalSteps]);

  const play = useCallback(() => {
    setCurrentStepIndex((prev) => {
      if (prev < 0 || prev >= totalSteps - 1) return 0;
      return prev;
    });
    setIsPlaying(true);
  }, [totalSteps]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    clearTimer();
  }, [clearTimer]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (prev) {
        clearTimer();
        return false;
      }
      setCurrentStepIndex((idx) => {
        if (idx < 0 || idx >= totalSteps - 1) return 0;
        return idx;
      });
      return true;
    });
  }, [clearTimer, totalSteps]);

  const restart = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
    setCurrentStepIndex(-1);
  }, [clearTimer]);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      if (prev === 1) return 2;
      if (prev === 2) return 3;
      return 1;
    });
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev);
  }, []);

  const jumpToStep = useCallback((index: number) => {
    clearTimer();
    setIsPlaying(false);
    setCurrentStepIndex(index);
  }, [clearTimer]);

  // cleanup on unmount
  useEffect(() => clearTimer, [clearTimer]);

  const state: PlaybackState = { currentStepIndex, isPlaying, speed, isLooping };
  const controls: PlaybackControls = {
    play, pause, togglePlay, restart, cycleSpeed, toggleLoop, jumpToStep,
  };

  return [state, controls];
}
