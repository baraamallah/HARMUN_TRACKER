
'use server';
/**
 * @fileOverview Generates an avatar image using AI.
 *
 * - generateAvatar - A function that handles avatar generation.
 * - GenerateAvatarInput - The input type for the generateAvatar function.
 * - GenerateAvatarOutput - The return type for the generateAvatar function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAvatarInputSchema = z.object({
  prompt: z.string().describe('A descriptive prompt for the avatar image, e.g., "professional avatar for a student diplomat".'),
  name: z.string().describe('The name of the person for context.'),
});
export type GenerateAvatarInput = z.infer<typeof GenerateAvatarInputSchema>;

const GenerateAvatarOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated avatar image as a data URI (e.g., 'data:image/png;base64,...')."),
  revisedPrompt: z.string().optional().describe("The prompt that was actually used if modified by the model/system."),
});
export type GenerateAvatarOutput = z.infer<typeof GenerateAvatarOutputSchema>;

export async function generateAvatar(input: GenerateAvatarInput): Promise<GenerateAvatarOutput> {
  return generateAvatarFlow(input);
}

const generateAvatarFlow = ai.defineFlow(
  {
    name: 'generateAvatarFlow',
    inputSchema: GenerateAvatarInputSchema,
    outputSchema: GenerateAvatarOutputSchema,
  },
  async (input) => {
    // Updated prompt to be more specific and request square aspect ratio
    const fullPrompt = `Generate a professional, diverse, and inclusive avatar suitable for a Model UN conference context.
    Focus on a clear, friendly facial portrait with a simple or neutral background. The image should be square aspect ratio.
    Base description for generation: ${input.prompt}.
    Person's Name (for contextual understanding, do not write the name on the avatar unless it's a subtle name tag and the model is good at text): ${input.name}.
    The avatar should be suitable for a profile picture.`;

    try {
      const {media, text, usage} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp',
        prompt: fullPrompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      if (!media?.url) {
        throw new Error('Image generation failed to produce a media URL.');
      }

      return {
        imageDataUri: media.url,
        revisedPrompt: text ?? undefined,
      };
    } catch (error: any) {
      console.error('Error in generateAvatarFlow:', error);
      throw new Error(`AI image generation failed: ${error.message || String(error)}`);
    }
  }
);

