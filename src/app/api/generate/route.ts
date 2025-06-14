import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  console.log('API route called');
  
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key is missing');
    return NextResponse.json(
      { error: 'OpenAI API key is not configured' },
      { status: 500 }
    );
  }
  
  console.log('API key found, length:', process.env.OPENAI_API_KEY.length);

  try {
    const formData = await request.formData();
    const image = formData.get('image');
    
    console.log('Received image:', {
      type: image?.constructor?.name,
      size: image instanceof Blob ? image.size : 'N/A',
      mimeType: image instanceof Blob ? image.type : 'N/A'
    });

    if (!image || !(image instanceof Blob)) {
      console.error('Invalid image:', { image });
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Convert image to base64
    const arrayBuffer = await image.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString('base64');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // First, analyze the image with GPT-4 Vision
    console.log('Analyzing image with GPT-4 Vision...');
    const visionResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${image.type};base64,${base64String}`
              }
            },
            { 
              type: 'text', 
              text: 'Describe this person for a minimalist Notion-style avatar. Focus ONLY on: overall face shape, hairstyle (shape and how it frames the face), basic facial expression (smiling, neutral, etc.), presence of glasses, and any truly distinctive features. DO NOT include details about texture, highlights, or shading. Keep the description very simple and focused on the key elements needed for a minimalist black and white illustration with clean lines and solid shapes. The description will be used to create a Notion-style avatar with very minimal facial features.'
            }
          ]
        }
      ],
      max_tokens: 300
    });

    const description = visionResponse.choices[0]?.message?.content;
    console.log('Vision analysis:', description);

    if (!description) {
      throw new Error('Failed to analyze the image');
    }

    if (description.length < 20) {
      console.error('Description too short:', description);
      throw new Error('Image analysis produced insufficient description');
    }

    // Now generate the avatar with DALL-E
    console.log('Generating avatar with DALL-E...');
    const prompt = `Create a Notion-style avatar illustration based on this person's description: ${description}

STYLE REQUIREMENTS (EXTREMELY IMPORTANT):
1. Pure black and white illustration with NO gray tones, NO highlights, and NO shading
2. ABSOLUTELY NO BORDERS OR FRAMES around the avatar - just the face/head on white background
3. Specific Notion-style facial features:
   - Eyes: simple curved lines or small ovals, never large cartoon eyes
   - Eyebrows: thin, simple lines
   - Nose: minimal representation or often omitted entirely
   - Mouth: simple curved line for smile or neutral expression
4. Hair must be solid black with NO internal lines, NO highlights, and NO texture details
5. If glasses present, use thin, simple lines
6. Just show head and possibly neck/shoulders - no full body
7. Clean white background with absolutely no borders, frames, or decorative elements

The avatar must look EXACTLY like the authentic Notion avatars - clean, simple black and white illustrations with minimal details. Create just ONE avatar centered in the frame.

Reference style: Simple black and white head illustrations with minimal facial features, solid black hair with no highlights, and clean white backgrounds with no frames.`;
    
    console.log('DALL-E prompt:', prompt);

    // Add a final reminder about no borders or frames
    const finalPrompt = `${prompt}\n\nFINAL CRITICAL INSTRUCTIONS:\n1. The background MUST be pure white (#FFFFFF) with NO borders, frames, or backgrounds of any kind.\n2. The avatar must be just the head/face floating on a white background.\n3. DO NOT add any decorative elements, borders, or frames.\n4. Hair must be solid black with no internal lines or highlights.\n5. Facial features must be extremely minimal - simple lines for eyes and mouth.`;
    
    console.log('Final prompt:', finalPrompt);
    
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: finalPrompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
      quality: 'standard',
      style: 'vivid'
    });

    if (!imageResponse.data?.[0]?.url) {
      throw new Error('Failed to generate avatar');
    }

    return NextResponse.json({ url: imageResponse.data[0].url });

  } catch (error) {
    const err = error as Error & { response?: Response };
    console.error('Full error object:', err);
    console.error('Error message:', err.message);
    console.error('Error name:', err.name);
    console.error('Error stack:', err.stack);
    
    let apiErrorResponse = null;
    if (err.response) {
      apiErrorResponse = await err.response.json().catch(() => 'No JSON response');
      console.error('OpenAI API error response:', apiErrorResponse);
    }

    return NextResponse.json(
      { 
        error: err.message || 'Failed to generate avatar',
        details: {
          message: err.message,
          name: err.name,
          stack: err.stack,
          response: apiErrorResponse
        }
      },
      { status: 500 }
    );
  }
}
