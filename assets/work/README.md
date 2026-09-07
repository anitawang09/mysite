# Work photos

One photo per job, shown inside the polaroid frame on the Experience strip.

## Adding one

1. Drop the image in this folder.
2. Name it in `manifest.json` under the card's key:

```json
{
  "photos": {
    "tbauctions": "tba-desk.jpg",
    "atsa": { "file": "gala-night.jpg", "alt": "What the photo shows" }
  }
}
```

Either form works. The longer one adds alt text, which is what a screen
reader announces; without it the card falls back to the job title.

The keys come from `data-photo` on each `<li class="polaroid">` in
`index.html`. They are, newest first:

| key          | job                                        | photo |
|--------------|--------------------------------------------|-------|
| `tbauctions` | HR Information Management Intern           | |
| `atsa`       | Event & Project Coordinator                | ✅ |
| `akitsu`     | Waitress                                   | ✅ |
| `pharmalinx` | Pharmacist Assistant                       | ✅ |
| `fantuan`    | Brand Promoter / Sales                     | ✅ |
| `kodis`      | Research Assistant                         | |

## What works best

- **Square.** The well is 1:1 and the image is cropped to fill it, so
  anything off-centre loses its edges. Crop to a square first if the
  subject matters.
- **About 800×800.** Larger just costs load time; smaller goes soft.
- **JPG for photos, PNG if it has flat colour or text.**
- **Re-saved on the way in**, which drops the camera and location data
  phones write into a photo file. Worth doing to anything you add by hand.

A card with no photo listed keeps its initials panel, which is a finished
look in its own right — so add them one at a time, in any order.
