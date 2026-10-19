import { useState } from "react";
import { Box, Button, Divider, IconButton, Stack, Tooltip } from "@mui/material";
import FormatBold from "@mui/icons-material/FormatBold";
import FormatItalic from "@mui/icons-material/FormatItalic";
import FormatListBulleted from "@mui/icons-material/FormatListBulleted";
import FormatListNumbered from "@mui/icons-material/FormatListNumbered";
import Title from "@mui/icons-material/Title";
import Undo from "@mui/icons-material/Undo";
import Redo from "@mui/icons-material/Redo";
import TableChart from "@mui/icons-material/TableChart";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { memoBodySx } from "./memoBodySx";

interface Props {
  html: string;
  onSave: (html: string) => Promise<void> | void;
  onCancel: () => void;
}

function Tool({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          disabled={disabled}
          onClick={onClick}
          color={active ? "primary" : "default"}
          sx={{ bgcolor: active ? "action.selected" : undefined, borderRadius: 1 }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const inTable = editor.isActive("table");
  return (
    <Stack
      sx={{
        flexDirection: "row",
        alignItems: "center",
        gap: 0.25,
        flexWrap: "wrap",
        p: 0.5,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "action.hover",
      }}
    >
      <Tool
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <FormatBold fontSize="small" />
      </Tool>
      <Tool
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <FormatItalic fontSize="small" />
      </Tool>
      <Tool
        title="Subheading"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Title fontSize="small" />
      </Tool>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Tool
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <FormatListBulleted fontSize="small" />
      </Tool>
      <Tool
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <FormatListNumbered fontSize="small" />
      </Tool>
      <Tool
        title="Insert table"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <TableChart fontSize="small" />
      </Tool>
      {inTable && (
        <>
          <Button size="small" onClick={() => editor.chain().focus().addRowAfter().run()}>
            + Row
          </Button>
          <Button size="small" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            + Column
          </Button>
          <Button size="small" onClick={() => editor.chain().focus().deleteRow().run()}>
            − Row
          </Button>
          <Button size="small" onClick={() => editor.chain().focus().deleteColumn().run()}>
            − Column
          </Button>
          <Button
            size="small"
            color="error"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            Delete table
          </Button>
        </>
      )}
      <Box sx={{ flexGrow: 1 }} />
      <Tool
        title="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo fontSize="small" />
      </Tool>
      <Tool
        title="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo fontSize="small" />
      </Tool>
    </Stack>
  );
}

/** Inline WYSIWYG editor for one memo section. Stored content is the editor's HTML. */
export default function SectionEditor({ html, onSave, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: html,
    autofocus: "end",
  });
  if (!editor) return null;

  const save = async () => {
    setSaving(true);
    try {
      await onSave(editor.getHTML());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ border: 1, borderColor: "primary.main", borderRadius: 1, overflow: "hidden" }}>
      <Toolbar editor={editor} />
      <Box sx={{ p: 1.5, ...memoBodySx }}>
        <EditorContent editor={editor} />
      </Box>
      <Stack
        sx={{
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 1,
          p: 1,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Button size="small" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="small" variant="contained" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save section"}
        </Button>
      </Stack>
    </Box>
  );
}
