'use client';

import { useState } from 'react';
import { StepPlayer } from '@/src/components/StepPlayer';
import type { Frame } from '@/src/engine/types';
import { FRAMES, LINEAGE_LEGEND, lineageStep } from './step';

// Trang thử: dùng thẳng StepPlayer với một bước duy nhất, không qua catalog hay LessonView.
export function LineageLab() {
  const [speed, setSpeed] = useState(1);
  const { Body } = lineageStep;
  return (
    <>
      <StepPlayer
        step={lineageStep}
        frames={FRAMES as Frame<unknown>[]}
        legend={LINEAGE_LEGEND}
        speed={speed}
        onSpeed={setSpeed}
        onAnswer={() => {}}
      />
      <Body frames={FRAMES} />
    </>
  );
}
