import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key is not configured' },
      { status: 500 }
    );
  }

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
              text: 'Describe this person for a Notion-style avatar. Focus on: gender presentation, face shape (round/oval/etc), exact hairstyle details (length, texture, how it falls), glasses if any (shape and size), key facial features (eyes, eyebrows, nose, lips), and overall expression. Be specific about features that make them uniquely recognizable.'
            }
          ]
        }
      ],
      max_tokens: 1000
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
    const prompt = `Create a minimalist Notion-style avatar that looks hand-drawn. The style should be extremely simple black and white illustration, similar to these key characteristics:

ESSENTIAL STYLE:
1. Completely flat black and white only - no gradients or gray tones
2. Face shape is often implied rather than outlined
3. Eyes are super simple - just curved lines, dots, or basic shapes
4. Mouth is a simple line or curve showing expression
5. Hair should be bold black shapes with clean edges
6. If glasses present, use basic round or rectangular frames
7. Minimal to no facial details - omit nose unless absolutely necessary

CRITICAL REQUIREMENTS:
- Must be pure black (#000000) on white (#FFFFFF) background
- Absolutely no outlines around the face
- No shading or gradients whatsoever
- Asymmetrical features are encouraged for character
- Keep details to absolute minimum - less is more
- Should look casually hand-drawn, not digital or perfect
- Aim for a friendly, approachable feel

The final result should look like a simple doodle that captures personality with just a few strokes - similar to Notion's avatar style.`;
    
    console.log('DALL-E prompt:', prompt);

    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
      quality: 'hd',
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
