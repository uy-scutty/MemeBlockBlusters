// lib/prompts.ts
import { Vibe, DirectorStyle } from "@/types";

export const SCENE_COUNT = 8;

interface TrendingTemplate {
  id: string;
  title: string;
  vibe: Vibe;
  director: DirectorStyle;
  description: string;
}

// Trending templates for the landing page
export const TRENDING_TEMPLATES: TrendingTemplate[] = [
  {
    id: "epic-hero",
    title: "Epic Hero's Journey",
    vibe: "Epic",
    director: "Nolan",
    description: "A dramatic hero's journey with stunning visuals"
  },
  {
    id: "funny-cat",
    title: "Funny Cat Chronicles",
    vibe: "Funny",
    director: "Waititi",
    description: "Hilarious cat adventures with witty narration"
  },
  {
    id: "dark-mystery",
    title: "Dark Mystery Thriller",
    vibe: "Dark",
    director: "Fincher",
    description: "Gripping mystery with dark atmospheric tones"
  },
  {
    id: "romantic-comedy",
    title: "Romantic Comedy",
    vibe: "Romantic",
    director: "Gerwig",
    description: "Heartwarming love story with comedic moments"
  },
  {
    id: "sci-fi-epic",
    title: "Sci-Fi Epic",
    vibe: "SciFi",
    director: "Villeneuve",
    description: "Futuristic sci-fi with mind-bending visuals"
  },
  {
    id: "thriller-twist",
    title: "Thriller with a Twist",
    vibe: "Thriller",
    director: "Shyamalan",
    description: "Suspenseful thriller with unexpected turns"
  },
  {
    id: "action-explosion",
    title: "Action Explosion",
    vibe: "Epic",
    director: "Bay",
    description: "Explosive action with dramatic slow-motion sequences"
  }
];

// Director style notes for Higgsfield prompts
export const DIRECTOR_STYLE_NOTES = {
  Nolan: "Christopher Nolan style - epic scale, IMAX framing, practical effects, orchestral score, dark tones",
  Waititi: "Taika Waititi style - whimsical, colorful, comedic timing, warm lighting, quirky characters",
  Fincher: "David Fincher style - dark, moody, desaturated, precise framing, tense atmosphere",
  Gerwig: "Greta Gerwig style - warm pastels, intimate close-ups, natural lighting, emotional depth",
  Villeneuve: "Denis Villeneuve style - vast landscapes, minimal dialogue, dramatic shadows, atmospheric",
  Shyamalan: "M. Night Shyamalan style - suspenseful, eerie, subtle, moody, unexpected reveals",
  Bay: "Michael Bay style - explosive action, dramatic slow-motion, high contrast, intense colors, epic scale"
};

export function buildScenePlannerSystemPrompt(vibe: string, director: string) {
  return `You are a cinematic trailer script writer. Generate ${SCENE_COUNT} scenes for a ${vibe} vibe trailer in the style of ${director}.

Each scene must have:
- visual: A detailed visual description  
- voiceover: A dramatic narration line

Return JSON format: { "scenes": [{"visual": "...", "voiceover": "..."}] }
`;
}

// FALLBACK SCENES - used when AI is overloaded
export function generateFallbackScenes(idea: string, vibe: string, director: string) {
  const vibeStyles = {
    Epic: ["grand", "heroic", "dramatic"],
    Funny: ["humorous", "hilarious", "comedy"],
    Dark: ["ominous", "mysterious", "intense"],
    Romantic: ["emotional", "passionate", "heartfelt"],
    SciFi: ["futuristic", "technological", "alien"],
    Thriller: ["suspenseful", "edge-of-your-seat", "twisted"],
  };

  const style = vibeStyles[vibe as keyof typeof vibeStyles] || vibeStyles.Epic;
  const vibeWord = style[0] || "dramatic";

  return {
    scenes: [
      {
        visual: `Opening shot: ${idea} comes to life in a ${vibeWord} way`,
        voiceover: `In a world where memes shape reality...`
      },
      {
        visual: `The protagonist discovers the power of ${idea}`,
        voiceover: `One person holds the key to it all...`
      },
      {
        visual: `${idea} spreads like wildfire through the digital realm`,
        voiceover: `What begins as a joke becomes a global phenomenon...`
      },
      {
        visual: `The antagonist emerges to stop the ${vibeWord} meme`,
        voiceover: `But some forces cannot be controlled...`
      },
      {
        visual: `The hero faces their greatest challenge yet`,
        voiceover: `In the darkness, a glimmer of hope survives...`
      },
      {
        visual: `${idea} reaches its peak influence and power`,
        voiceover: `They said it was impossible...`
      },
      {
        visual: `The final confrontation between good and meme`,
        voiceover: `This is the moment of truth...`
      },
      {
        visual: `${idea} lives on forever in digital history`,
        voiceover: `Long live the meme.`
      }
    ]
  };
}