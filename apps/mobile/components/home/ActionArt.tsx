import Svg, { Circle, Line, Path } from 'react-native-svg';

export type ActionArtId = 'capture' | 'ask' | 'search' | 'recall' | 'projects' | 'timeline';

type MarkProps = {
  color: string;
  accent: string;
};

/**
 * Small vector marks for the home actions. `accent` is the highlight stroke or dot.
 */
export function ActionArt({
  id,
  size = 28,
  color,
  accent,
}: {
  id: ActionArtId;
  size?: number;
  color: string;
  accent: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {id === 'capture' ? <CaptureMark color={color} accent={accent} /> : null}
      {id === 'ask' ? <AskMark color={color} accent={accent} /> : null}
      {id === 'search' ? <SearchMark color={color} accent={accent} /> : null}
      {id === 'recall' ? <RecallMark color={color} accent={accent} /> : null}
      {id === 'projects' ? <ProjectsMark color={color} accent={accent} /> : null}
      {id === 'timeline' ? <TimelineMark color={color} accent={accent} /> : null}
    </Svg>
  );
}

function CaptureMark({ color, accent }: MarkProps) {
  return (
    <>
      <Path d="M9 12V8h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M19 8h4v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M23 20v4h-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M13 24H9v-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={16} cy={16} r={3.2} fill={accent} />
    </>
  );
}

function AskMark({ color, accent }: MarkProps) {
  return (
    <>
      <Path
        d="M7 10h16a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-8l-5 4v-4H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={11} cy={16} r={1.25} fill={accent} />
      <Circle cx={15.5} cy={16} r={1.25} fill={color} />
      <Circle cx={20} cy={16} r={1.25} fill={color} />
    </>
  );
}

function SearchMark({ color, accent }: MarkProps) {
  return (
    <>
      <Circle cx={14} cy={14} r={6.5} stroke={color} strokeWidth={1.8} fill="none" />
      <Line x1={19} y1={19} x2={25.5} y2={25.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={14} cy={14} r={2.1} fill={accent} />
    </>
  );
}

function RecallMark({ color, accent }: MarkProps) {
  return (
    <>
      <Path
        d="M4 16c4-6 20-6 24 0-4 6-20 6-24 0Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={16} cy={16} r={3.4} stroke={color} strokeWidth={1.6} fill="none" />
      <Circle cx={16} cy={16} r={1.6} fill={accent} />
    </>
  );
}

function ProjectsMark({ color, accent }: MarkProps) {
  return (
    <>
      <Path
        d="M5 12.5V23a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V14a2 2 0 0 0-2-2h-9l-2-3H7a2 2 0 0 0-2 2.5Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Line x1={18} y1={18} x2={24} y2={18} stroke={accent} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

function TimelineMark({ color, accent }: MarkProps) {
  return (
    <>
      <Line x1={9} y1={6} x2={9} y2={26} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={9} cy={8} r={2} fill={color} />
      <Circle cx={9} cy={16} r={2.4} fill={accent} />
      <Circle cx={9} cy={24} r={2} stroke={color} strokeWidth={1.6} fill="none" />
      <Line x1={14} y1={8} x2={23} y2={8} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={14} y1={16} x2={26} y2={16} stroke={accent} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={14} y1={24} x2={21} y2={24} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </>
  );
}
