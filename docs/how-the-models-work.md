# How the machine learning in PhotoSpec actually works

PhotoSpec uses two small pre-trained models. Neither of them is "AI" in the way
that phrase is normally used in 2026: there is no language model, no API call,
no server, no account, and nothing about your photo is ever sent anywhere. They
are closer to a very specialised image filter that was tuned by example instead
of by hand.

This document explains what they are and how they work, because understanding
them is the difference between using a library and knowing what your program is
doing.

---

## 1. The problem neither classical code nor a model solves alone

We need two facts about the photo:

- **Where is the person?** So we can replace the background with white.
- **Where is the head?** So we can crop to a legal head height.

Classical computer vision can *almost* do the first. You can look for edges, or
flood-fill from the corners, or run GrabCut with a user-drawn box. All of these
fall apart on the same thing: **hair**. Hair is thousands of thin strands, each
partly transparent, against a background of unknown colour. There is no rule you
can write down that says "this pixel is 40% hair and 60% wall", which is what
the truth actually is.

So we use a model that learned that judgement from examples.

---

## 2. What the segmentation model is

The file is `selfie_segmenter.tflite`, about 2 MB, published by Google under
Apache 2.0.

Inside, it is a **convolutional neural network** with an encoder–decoder shape,
often called a U-Net:

```
   256x256 RGB input
          |
      [ ENCODER ]     downsamples, learns "what is here"
   256 -> 128 -> 64 -> 32 -> 16       (spatial detail falls, meaning rises)
          |
      [ DECODER ]     upsamples, learns "where exactly"
   16 -> 32 -> 64 -> 128 -> 256
          |
   256x256 probability map
```

The encoder repeatedly shrinks the image while growing the number of feature
channels. Early layers respond to simple things, an edge at 30 degrees, a patch
of skin tone. Later layers respond to composites, "shoulder-like", "hair-like".
By the 16×16 bottleneck the network has a rich description of *what* is in the
image but has thrown away most of *where*.

The decoder builds the resolution back up. On its own it would produce a blurry
blob, so **skip connections** feed the high-resolution early layers directly
across to the matching decoder layers. That is the trick that lets the output
have crisp edges: meaning comes up from the bottleneck, precision comes across
from the skips.

### What comes out

Not a yes/no mask. For every one of the 65,536 output pixels, the model emits a
number between 0 and 1: **the probability that this pixel is part of the
person**.

A strand of hair with wall showing through might come out at 0.45. That soft
value is exactly what we want, and it is why `MediaPipeBackgroundRemover` keeps
the float confidence mask instead of thresholding it to 0 or 255. When we
composite, that 0.45 becomes 45% opacity, and the hair blends into the new white
background the way it blended into the old wall. Threshold it and you get the
scissor-cut look that makes a photo obviously edited.

### Why it is only 2 MB

Roughly a million parameters, stored as 16-bit floats rather than 32-bit. Modern
mobile architectures (this one is MobileNetV3-flavoured) use *depthwise separable
convolutions*: instead of one expensive operation mixing all channels and all
spatial positions at once, they split it into a cheap spatial pass and a cheap
channel-mixing pass. Same expressive power, a fraction of the arithmetic.

For comparison: a large language model has hundreds of billions of parameters.
This is about 0.001% of that. It is a small, sharp tool.

### Why it is good at you and useless at your cat

It was trained on tens of thousands of hand-labelled selfies: a person, roughly
centred, head and shoulders, facing the camera. Every weight in it was adjusted
to reduce the error on *that* distribution of images.

That is why it suits a passport photo perfectly and would fail on a landscape, a
group shot, or a dog. It didn't learn "segmentation". It learned "selfies".

---

## 3. What the face landmark model is

`face_landmarker.task` is a different shape of model. It is a **regression**
network, not a segmentation one: instead of labelling pixels, it outputs a fixed
list of coordinates.

It runs in two stages:

1. A small detector finds the bounding box of a face in the frame.
2. A second network crops to that box and predicts **478 landmark points**, each
   an (x, y, z) triple in normalised coordinates.

Those 478 points are a fixed, ordered mesh. Point 152 is always the bottom of the
chin. Point 33 is always the outer corner of the right eye. That is why
`MediaPipeFaceAnalyzer` can name them as constants. The numbering is part of the
model's contract, not something we discovered.

---

## 4. The gap between them, and why we wrote CrownLocator

Here is the thing that surprises people, and the most interesting engineering
problem in this project:

**The face landmark model cannot tell you where the top of the head is.**

Its 478 points describe the *face*: jaw, brows, eyes, nose, lips, and the face
oval. Hair is not a facial feature, so no landmark marks the crown. But every ID
photo specification in the world measures head height from **chin to crown,
including hair**. Without a crown, you cannot compute a legal crop.

The segmentation model, meanwhile, knows exactly where hair is, hair is part of
the person, but it has no idea which part of the blob is a head.

So we combine them:

```
landmarks  ->  "the face spans x = 820 to x = 1180"
                          |
                          v
mask       ->  scan down from the top, inside that column
                          |
                          v
           ->  first row with a convincing run of person pixels
                          |
                          v
                    that row IS the crown
```

That is `src/domain/photo-processing/service/CrownLocator.ts`. The window is
widened by 25% because hair is wider than the face, and a minimum run length
rejects the stray speckle that segmentation models produce near frame edges.

The lesson generalises: models give you capabilities, not answers. The value is
usually in the code that combines them.

---

## 5. How it runs without a server

The `.tflite` file is a **TensorFlow Lite** model: a serialised graph of
operations plus the weight matrices.

MediaPipe ships a WebAssembly build of the TFLite interpreter. Your browser:

1. Downloads the WASM runtime and the model file once, then caches both.
2. Hands the interpreter your image as a typed array.
3. The interpreter walks the graph, doing matrix multiplications and
   convolutions, using WebGL or WebGPU when the machine offers it and plain
   CPU SIMD otherwise.
4. Returns the output array.

Every step happens inside the tab. There is no request carrying your photo. You
can verify this yourself: open the network tab, prepare a photo, and watch,
after the initial model download there is no traffic at all. Turn off your wifi
after the first load and the app keeps working.

---

## 6. How this differs from the "AI" you are used to

| | Large language model | These models |
|---|---|---|
| Size | Hundreds of GB | 2 MB and 3 MB |
| Where it runs | Someone else's datacentre | Your browser tab |
| Sees your data | Yes, by definition | No, never leaves the device |
| Output | Generated text, varies per run | A fixed-size array of numbers, identical every run |
| Learns from you | Sometimes | Never. The weights are frozen in a file |
| Cost per use | Metered | Zero |

The last row is worth dwelling on. These models are **deterministic**. The same
photo produces bit-identical output every time. That is what lets us unit-test
around them and why they behave like a library rather than a service.

---

## 7. The limits worth knowing

- **The mask is low resolution.** The model works at 256×256 internally, so the
  mask is upscaled to your photo's size. That is why the compositing step
  smooths it, and why very fine hair against a busy background still looks soft.
- **It expects a selfie.** Odd poses, extreme angles, strong backlighting, or two
  people in frame all degrade it. We reject multi-face photos rather than guess.
- **It has no concept of correctness.** It returns a probability, not a promise.
  This is exactly why `ComplianceChecker` measures the *result* in millimetres
  and tells the user when it is wrong, instead of trusting the pipeline.

---

---

## 8. On increasing resolution

A recurring question: can the tool make a soft photo sharper?

**No amount of processing invents detail the camera never captured.** If a face
occupies 500 pixels in the original, that is how much information exists about
it. Everything else is guesswork dressed up as pixels.

What PhotoSpec does instead, in order of how much it actually helps:

1. **Stop discarding detail you already have.** The output resolution is chosen
   from what the crop supports, not from a fixed 600 dpi. A close-up 12 MP phone
   photo supports around 1000 dpi across a 35 mm print; the first version threw
   40% of that away.
2. **Resample properly.** Browsers downscale in one step with a small kernel,
   which discards most source pixels without averaging them. Halving repeatedly
   averages everything on the way down. This is the single biggest visible
   improvement and costs a few milliseconds.
3. **Sharpen honestly.** An unsharp mask restores the local contrast that
   resizing averages away. It recovers no information, it makes the information
   that survived easier to see.
4. **Tell the truth when the source is too poor**, and say what would fix it:
   stand closer, use the main camera rather than the selfie camera, and transfer
   the original file rather than sending it through a messaging app, which
   typically halves the resolution and adds compression artefacts.

### Why not a super-resolution model?

They exist, they are impressive, and PhotoSpec deliberately does not use one.

A super-resolution network **invents plausible facial detail**: it produces the
skin texture, the eyelashes, the hairline that a face *like* yours would have.
For a wallpaper that is delightful. For a document whose entire purpose is to
prove that a face is yours, generating facial detail that was never photographed
is the wrong thing to do, and it would move this tool from formatting a
photograph to altering a face, which is precisely what issuing authorities are
worried about.

The line PhotoSpec draws is: rearrange and clean up what the camera recorded,
never invent what it did not.

---

## Where to look in the code

| Concept | File |
|---|---|
| Loading the shared WASM runtime | `src/infrastructure/mediapipe/vision.ts` |
| Running segmentation, keeping soft edges | `src/infrastructure/segmentation/MediaPipeBackgroundRemover.ts` |
| Reading named landmarks | `src/infrastructure/face/MediaPipeFaceAnalyzer.ts` |
| Combining the two to find the crown | `src/domain/photo-processing/service/CrownLocator.ts` |
| Compositing with the soft mask | `src/infrastructure/rendering/CanvasImageRenderer.ts` |
| Stepped resampling and unsharp mask | `src/infrastructure/rendering/resample.ts` |
| Choosing the output resolution | `src/domain/photo-spec/service/PrintResolution.ts` |

## Further reading

- [MediaPipe Image Segmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter)
- [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
- [U-Net: Convolutional Networks for Biomedical Image Segmentation](https://arxiv.org/abs/1505.04597). The paper that introduced the encoder–decoder-with-skips shape
- [MobileNetV3](https://arxiv.org/abs/1905.02244), where the efficient building blocks come from
