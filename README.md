# Peak Sports Academy prototype

Static, local-only client-review website created from the provisional PRD and supplied project assets.

## Run locally

From this directory:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Prototype behavior

- Top navigation includes Programmes and Login.
- Registration fields and four separate local file selectors—Photo, Passport, Emirates ID Front, and Emirates ID Back—are optional. Each selector accepts one JPG/JPEG, PNG, or PDF file up to 10 MB. No separate visa-page or insurance selector is included.
- Age is read-only and automatically calculated in completed years from Date of Birth in registration and Admin editing.
- Acknowledgment Date and Time default to the device's current local date and time for each new registration, while remaining optional and editable or clearable by both the visitor and Admin.
- The optional signature is represented by an editable typed full name in public registration and Admin; no drawn-signature control is included.
- Terms, disclaimer, and acknowledgment wording are transcribed from the supplied paper-form image and shown as draft content pending legal approval. The draft is expanded by default on desktop and available through an expandable panel on mobile.
- Parent information follows the source image as two combined optional fields: `Fathers Name & Occupation` and `Mothers Name & Occupation`. Existing storage keys remain compatible.
- Selected files are previewed locally and are never uploaded.
- Submitted dummy records are stored in this browser and remain across refreshes until an Admin uses **Reset test data**.
- Admin credentials are `admin` / `admin` for demonstration only.
- Admin can edit every registration value, manage office-use details and status, replace or remove document metadata, and delete individual records. Only selected filenames, types, and sizes are retained; document contents are never stored.
- The complete prototype catalogue contains two programmes: Weekday Batch and Weekend Batch. Details come from the supplied batch-timings source, and fees are displayed in UAE dirhams (AED).
- The current PSA logo and supplied coaching images are approved for the final website.

## Clarifications still needed

The supplied sources do not establish the following. They have deliberately not been guessed:

- Final legal approval of the transcribed terms, disclaimer, and acknowledgment wording.
