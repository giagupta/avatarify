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
              text: 'Describe this person for a cartoon-style Notion avatar. Focus on: face shape, hairstyle details (style, length, volume, how it frames the face), facial expression, eyebrows, eye shape, glasses if any, facial hair if any, and any distinctive features that make them recognizable. The description will be used to create a black and white cartoon-style avatar with simple but expressive features. Pay special attention to what makes their appearance unique.'
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
    const prompt = `Create a cartoon-style avatar in the exact style of the Notion avatar examples, based on this person's description: ${description}

STYLE REQUIREMENTS (EXTREMELY IMPORTANT):
1. Black and white cartoon style with clean lines and solid black fills
2. More expressive and detailed than ultra-minimalist style
3. Face should have simple but distinct features:
   - Eyes can be small dots, lines, or simple shapes with eyebrows when appropriate
   - Mouth should show expression (smile, neutral, etc.)
   - Simple nose representation (small dots or lines)
   - Ears when visible from the angle
4. Hair should be a distinct black shape with some internal detail/lines to suggest texture
5. Include glasses, facial hair, or other distinctive features if present
6. Head/shoulders composition in a square frame
7. Clean white background with no borders

The avatar must look exactly like the Notion cartoon avatars - simple black and white illustrations with personality and expression. Create just ONE avatar centered in the frame.

Reference style: Black and white cartoon-style avatars with expressive faces, distinct hairstyles, and simple but recognizable facial features.`;
    
    console.log('DALL-E prompt:', prompt);

    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
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
