1. Garaaz (Garage)
  Multiple shelves
    Storage boxes

2. Kelder (Cellar)
  Multiple shelves
    Storage boxes

3. Magamistuba (Bedroom)
  Multiple shelves
    Storage boxes

4. Elutuba (Livingroom)
  Multiple shelves
    Storage boxes

5. Koridor (Corridor)
  Multiple shelves
    Storage boxes

Designing a labeling system for a 14x40mm area requires a balance between **scannability** (for the QR code) and **readability** (for the human eye).

Your idea of `GS1B1` is a great start. However, to make it truly intuitive at a glance, especially across different rooms, I recommend a slightly more structured approach.

### 1. Recommended Naming Convention: The "Segmented" Code

Using a **Location-Shelf-Box** format is the gold standard for organization. To keep it short and readable, use a 2-letter prefix for the room.

| Room | Code | Example (Shelf 2, Box 5) |
| --- | --- | --- |
| **Garaaz** (Garage) | **GA** | `GA-02-05` |
| **Kelder** (Cellar) | **KE** | `KE-01-12` |
| **Magamistuba** (Bedroom) | **MA** | `MA-03-01` |
| **Elutuba** (Living room) | **EL** | `EL-01-04` |
| **Koridor** (Corridor) | **KO** | `KO-02-08` |

**Why this works:**

* **Unique Prefixes:** GA, KE, MA, EL, and KO are all distinct enough that you won't confuse them.
* **Leading Zeros:** Using `01` instead of `1` keeps the character count consistent, which helps with visual alignment on the labels.
* **Hyphens:** Adding a separator makes it much easier for the human brain to "chunk" the information compared to a solid string like `GS1B1`.

---

### 2. Label Layout Design (14x40mm)

Since your label is wide (40mm) but short (14mm), a **side-by-side** layout is more efficient than a top-bottom layout. This allows the QR code to be large enough for phone cameras to trigger quickly.

**Layout Specifications:**

* **Left Side (14x14mm):** QR Code.
* *Tip:* Your URL `https://s.go/[8-char-hash]` is short, which is perfect. It results in a "low-density" QR code that is very easy for sensors to read.


* **Right Side (26x14mm):** Human Readable Text.
* **Line 1 (Bold/Large):** The Short Code (e.g., **GA-02-05**).
* **Line 2 (Small):** The Room Name (e.g., Garaaz) to help guests or family members.



---

### 3. Implementation Tips

* **QR Error Correction:** When generating the QR codes, set the Error Correction Level to **"M" (Medium)** or **"L" (Low)**. Since your URL is very short, you don't need high error correction; keeping it low will make the "dots" larger and easier to print on a small label.
* **Font Choice:** Use a **Sans-Serif** font (like Arial, Helvetica, or Roboto). These are much more legible at small sizes than "fancy" fonts.
* **Padding:** Ensure there is a small "quiet zone" (white space) around the QR code so the printer doesn't bleed the black ink into the edges of the label.

### 4. Logic for the QR Link

Since you are using a hash (`s.go/abcdefgh`), ensure your database/spreadsheet maps that hash directly to the "friendly name" (GA-02-05). This way, if you move a box from the Garage to the Cellar, you only have to update the digital record, not reprint the label.
