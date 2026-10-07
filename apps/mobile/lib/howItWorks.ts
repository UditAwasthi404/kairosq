export type HowItWorksGroup = 'capture' | 'memory' | 'intelligence' | 'device';

export type HowItWorksFeature = {
  id: string;
  group: HowItWorksGroup;
  title: string;
  summary: string;
  body: string;
  steps: string[];
  tryLabel?: string;
  tryHref?: string;
};

export const HOW_IT_WORKS_GROUPS: Array<{
  id: HowItWorksGroup;
  title: string;
  lead: string;
}> = [
  {
    id: 'capture',
    title: 'Capture',
    lead: 'Save a thought the moment it appears.',
  },
  {
    id: 'memory',
    title: 'Memories',
    lead: 'Open, edit, search, and connect what you saved.',
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    lead: 'Ask questions and see patterns from your own notes.',
  },
  {
    id: 'device',
    title: 'On this device',
    lead: 'Work offline. Sync when you are back.',
  },
];

export const HOW_IT_WORKS_FEATURES: HowItWorksFeature[] = [
  {
    id: 'quick-capture',
    group: 'capture',
    title: 'Quick Capture',
    summary: 'Type a thought or paste a link. That is the main way to save inside Kairos.',
    body: 'Quick Capture is the default in-app destination. Write a note or drop a URL. Kairos saves it, then processes the text so you can search and ask later.',
    steps: [
      'Open Capture something from Home, Timeline, or Search.',
      'Type a thought, or paste a link.',
      'Save. You will see Saved, then Processing, then Memory ready.',
    ],
    tryLabel: 'Open Quick Capture',
    tryHref: '/(app)/quick-capture',
  },
  {
    id: 'voice',
    group: 'capture',
    title: 'Voice',
    summary: 'Speak a thought. Kairos transcribes it into a memory.',
    body: 'Voice capture records on this device, then turns speech into text. You will see Saved, Transcribing…, then Memory ready. If transcription fails, you can try again.',
    steps: [
      'Open Voice from Capture or Quick Capture.',
      'Tap the microphone, speak, then Save.',
      'Wait for Transcribing… to become Memory ready.',
    ],
    tryLabel: 'Open Voice',
    tryHref: '/(app)/voice-capture',
  },
  {
    id: 'keyboard',
    group: 'capture',
    title: 'Keyboard',
    summary: 'Save text from any app using the Kairos keyboard.',
    body: 'The Kairos keyboard can send the current text into your memories without opening the full app first. After save you will see Saved to Kairos. If you are offline, it stays on this device until it can sync. On Android, Kairos also posts a notification when the upload finishes and when the memory is ready.',
    steps: [
      'Enable the Kairos keyboard in system settings.',
      'Type in any app, then tap Save on the Kairos bar.',
      'Open Timeline later to read the memory.',
    ],
  },
  {
    id: 'share',
    group: 'capture',
    title: 'Share',
    summary: 'Send text, links, screenshots, or files from other apps.',
    body: 'Choose Kairos from the system share sheet. Text and links become notes. Images and PDFs are saved as memories. A screenshot can show its image on the memory screen. Saving is never blocked just to show a preview.',
    steps: [
      'In another app, tap Share and choose Kairos.',
      'Wait for Saved to Kairos, or Saved on this device if you are offline.',
      'On Android, a notification confirms the upload. Tap it when the memory is ready.',
    ],
  },
  {
    id: 'widget',
    group: 'capture',
    title: 'Widget',
    summary: 'Capture, ask, or open today’s brief from your home screen.',
    body: 'Android has four Kairos widgets, in the same black and red as the app. Today shows a short line plus Capture and Ask. Capture and Shortcuts jump straight into saving. Ask opens a question about what you have kept.',
    steps: [
      'Long-press the home screen and add a Kairos widget.',
      'Choose Today, Capture, Ask, or Shortcuts.',
      'The result is the same memory you would create inside the app.',
    ],
  },
  {
    id: 'memories',
    group: 'memory',
    title: 'A memory',
    summary: 'Every capture becomes one memory you can open, edit, or delete.',
    body: 'A memory keeps its original source and time. You can edit the title and text. Editing updates search later. You can also attach it to a project, see related memories, or ask about that one memory.',
    steps: [
      'Open a memory from Timeline, Search, or Home.',
      'Use Edit this memory to change the title or text, then Save memory.',
      'Add it to a project, ask about it, or delete it if you no longer want it.',
    ],
    tryLabel: 'Open Timeline',
    tryHref: '/(app)/timeline',
  },
  {
    id: 'related',
    group: 'memory',
    title: 'Related memories',
    summary: 'See other notes that belong with the one you are reading.',
    body: 'Related memories look for nearby meaning, topics, people, and projects. Weak or unrelated notes are left out. If nothing is close, the list stays empty — Kairos will not invent a connection.',
    steps: [
      'Open a memory.',
      'Tap Related memories.',
      'Open a related note only if it actually helps.',
    ],
    tryLabel: 'Open Timeline',
    tryHref: '/(app)/timeline',
  },
  {
    id: 'search',
    group: 'memory',
    title: 'Search',
    summary: 'Ask in plain language, then narrow by source or date.',
    body: 'Type how you remember something: a name, a topic, or a phrase. Source and Date chips filter on the server. You can combine a question with chips, or use the chips after a natural-language search.',
    steps: [
      'Open Search and type what you remember.',
      'Optionally tap Source or Date, then choose a chip.',
      'Open a result to read the matching memory.',
    ],
    tryLabel: 'Open Search',
    tryHref: '/(app)/search',
  },
  {
    id: 'timeline',
    group: 'memory',
    title: 'Timeline',
    summary: 'Your memories in the order you captured them.',
    body: 'Timeline groups notes by day and shows where each one came from. Scroll to load more. Pull down to refresh. It does not try to load your whole history at once.',
    steps: [
      'Open Timeline from Home or Profile.',
      'Use the chips if you want one project, topic, or person.',
      'Tap a row to open that memory.',
    ],
    tryLabel: 'Open Timeline',
    tryHref: '/(app)/timeline',
  },
  {
    id: 'topics',
    group: 'memory',
    title: 'Topics and people',
    summary: 'Kairos labels memories after they are ready.',
    body: 'Topics and entities appear once a memory is processed. They are a way to browse, not a second notes system. Tap a chip on a memory to see other notes with the same label.',
    steps: [
      'Wait until a memory says Memory ready.',
      'Tap a topic or name on the memory.',
      'Or open Topics from Home or Profile to browse.',
    ],
    tryLabel: 'Open Topics',
    tryHref: '/(app)/topics',
  },
  {
    id: 'projects',
    group: 'memory',
    title: 'Projects',
    summary: 'Group memories around something you are working on.',
    body: 'A project is a folder you attach memories to. It does not create a second copy. Search and Ask can stay inside one project when you choose it.',
    steps: [
      'Create a project from Profile.',
      'Open a memory and tap Add to project.',
      'Open the project later to see only those memories.',
    ],
    tryLabel: 'Open Projects',
    tryHref: '/(app)/projects',
  },
  {
    id: 'ask',
    group: 'intelligence',
    title: 'Ask',
    summary: 'Ask a question. Answers come from your memories, with citations.',
    body: 'Ask searches your memories first, then answers only from that evidence. If there is not enough, it will say so. Asking about one memory keeps that note first and may include a few closely related notes.',
    steps: [
      'Open Ask, or Ask about this memory from a note.',
      'Ask in plain language.',
      'Tap a citation to open the memory it came from.',
    ],
    tryLabel: 'Open Ask',
    tryHref: '/(app)/(tabs)/ask',
  },
  {
    id: 'dashboard',
    group: 'intelligence',
    title: 'Dashboard',
    summary: 'A short reading of what you have been capturing.',
    body: 'Dashboard looks at your recent memories and shows a capture streak, a daily habit week, a twelve-week heatmap, a histogram of how many memories land on a day, and a few grounded insights. Each insight can point back to the notes it used. Empty days stay empty.',
    steps: [
      'Open Dashboard from Home or Profile.',
      'Check the streak and weekly capture habit against days you actually saved something.',
      'Read the insight only if it matches what you saved.',
      'Tap evidence to return to the original memory.',
    ],
    tryLabel: 'Open Dashboard',
    tryHref: '/(app)/dashboard',
  },
  {
    id: 'predictions',
    group: 'intelligence',
    title: 'Predictions',
    summary: 'Cautious patterns from past notes — not a forecast of your life.',
    body: 'Predictions are repeating shapes in what you already captured, such as a topic you return to. They are not calendar events or invented futures. If the evidence is thin, the list stays small.',
    steps: [
      'Open Predictions from Home or Profile.',
      'Read the why line under each pattern.',
      'Open the linked memories if you want to check the source.',
    ],
    tryLabel: 'Open Predictions',
    tryHref: '/(app)/predictions',
  },
  {
    id: 'brief',
    group: 'intelligence',
    title: 'Daily Brief',
    summary: 'A compact recap of today and what still needs attention.',
    body: 'The brief gathers today’s captures and any unfinished processing. It is a reading, not a task list. If you have not captured anything, it will say so.',
    steps: [
      'Open Daily brief from Home or Profile.',
      'Scan today’s memories and any items still processing.',
      'Open a memory if you want the full note.',
    ],
    tryLabel: 'Open Daily Brief',
    tryHref: '/(app)/brief',
  },
  {
    id: 'notifications',
    group: 'device',
    title: 'Notifications',
    summary: 'Android tells you when a capture uploads and when a memory is ready.',
    body: 'Share, keyboard, and queued uploads post a notification so you do not have to keep the app open. When processing finishes, Kairos sends another notification that opens that memory. Recall upload summaries are throttled so screen capture does not flood the tray.',
    steps: [
      'Allow notifications when Kairos asks, or later in system settings.',
      'Share or save a note. You should see Saved to Kairos.',
      'Tap Memory ready to open the finished note.',
    ],
    tryLabel: 'Open Updates',
    tryHref: '/(app)/notifications',
  },
  {
    id: 'offline',
    group: 'device',
    title: 'Offline and sync',
    summary: 'Captures saved here wait, then sync when you are online.',
    body: 'If a capture cannot reach Kairos, it is saved on this device. Profile shows how many are waiting. When you reopen the app online, they sync on their own. You do not need a second queue.',
    steps: [
      'Capture as usual, even without a connection.',
      'Look at Offline captures on Profile.',
      'Come back online. Waiting notes become Synced.',
    ],
    tryLabel: 'Open Profile',
    tryHref: '/(app)/(tabs)/profile',
  },
  {
    id: 'recall',
    group: 'device',
    title: 'Recall',
    summary: 'Optional on-device capture from your screen, when you turn it on.',
    body: 'Recall stays on this device first. It is a specialized capture path, not the default way to save a thought. Use Quick Capture, Share, Keyboard, or Voice for everyday notes.',
    steps: [
      'Open Recall only if you want screen capture.',
      'Follow the on-screen permission steps.',
      'Use Quick Capture for ordinary thoughts.',
    ],
    tryLabel: 'Open Recall',
    tryHref: '/(app)/screen-memory',
  },
];

export function howItWorksFeature(id: string): HowItWorksFeature | undefined {
  return HOW_IT_WORKS_FEATURES.find((feature) => feature.id === id);
}

export function howItWorksByGroup(group: HowItWorksGroup): HowItWorksFeature[] {
  return HOW_IT_WORKS_FEATURES.filter((feature) => feature.group === group);
}
