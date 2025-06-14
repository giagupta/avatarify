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
              text: 'Describe this person for an ultra-minimalist Notion-style avatar. Focus ONLY on the most distinctive features: face shape, hairstyle (shape, length, color), glasses if any, and any truly defining facial characteristics. Keep the description very brief and focused on what makes them recognizable in an extremely simplified form. The description will be used to create a minimalist black and white avatar with very few details.'
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
    const prompt = `Create an extremely minimalist avatar in the exact style of the Notion avatar examples, based on this person's description: ${description}

STYLE REQUIREMENTS (EXTREMELY IMPORTANT):
1. Ultra-minimalist black and white design - mostly solid black shapes on white background
2. Simple, rounded face shape with minimal features
3. Eyes should be very simple curved lines or small shapes
4. Mouth is just a simple curved line
5. Hair should be a solid black shape framing the face
6. If glasses are present, use simple round or oval outlines
7. No nose or only the tiniest suggestion of one
8. No shading, gradients, or unnecessary details

The avatar must look exactly like the Notion-style avatars - extremely simple, almost icon-like, but still capturing the person's key features (hair style, glasses, etc.). The face should be centered in a white background with good margins around it. Create just ONE avatar, not multiple variations.

Reference style: A minimalist black and white avatar with a simple rounded face, curved line eyes, simple smile, and solid black hair shape.`;
    
    console.log('DALL-E prompt:', prompt);

    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
      quality: 'standard',
      style: 'natural'
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
