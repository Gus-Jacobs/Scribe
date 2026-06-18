import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Code, Link, Quote,
  Heading1, Heading2, Heading3, ListOrdered, List, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Indent, Outdent, Image, Minus, Save, SaveAll, FolderOpen, Undo, Redo,
  Superscript, Subscript, Table, Book, FileText, FileSignature, Search,
  File, Printer, FileUp, X, Share2, Info, Sigma,
  Eraser, CaseSensitive, Text, Scissors, Copy, ClipboardPaste, Settings, FilePlus, MessageSquare, RefreshCw,
  Palette, PaintBucket, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Square, Circle, Triangle,
  Star, Heart, Fan, Hand, Smile, Laugh, Frown, Angry, ThumbsUp, ThumbsDown,
  Cloud, Sun, Moon, CloudDrizzle, CloudLightning, CloudRain, CloudSnow, Sunset, Wind,
  Navigation, MapPin, Globe, Compass, Ship, Plane, Train, Car, Bike,
  Award, Badge, Trophy, Medal, Gift, ToyBrick, Gamepad2, Glasses,
  Music, Clapperboard, Film, Radio, Podcast, Mic, Webcam, Video,
  Plus, Trash, Columns, Rows
} from 'lucide-react';


export const BoldIcon = () => <Bold />;
export const ItalicIcon = () => <Italic />;
export const UnderlineIcon = () => <Underline />;
export const StrikethroughIcon = () => <Strikethrough />;
export const CodeIcon = () => <Code />;
export const LinkIcon = () => <Link />;
export const QuoteIcon = () => <Quote />;
export const H1Icon = () => <Heading1 />;
export const H2Icon = () => <Heading2 />;
export const H3Icon = () => <Heading3 />;
export const NumberedListIcon = () => <ListOrdered />;
export const BulletedListIcon = () => <List />;
export const AlignLeftIcon = () => <AlignLeft />;
export const AlignCenterIcon = () => <AlignCenter />;
export const AlignRightIcon = () => <AlignRight />;
export const AlignJustifyIcon = () => <AlignJustify />;
export const IndentIcon = () => <Indent />;
export const OutdentIcon = () => <Outdent />;
export const ImageIcon = () => <Image />;
export const HorizontalRuleIcon = () => <Minus />;
export const SaveIcon = () => <Save />;
export const OpenIcon = () => <FolderOpen />;
export const UndoIcon = () => <Undo />;
export const RedoIcon = () => <Redo />;
export const SuperscriptIcon = () => <Superscript />;
export const SubscriptIcon = () => <Subscript />;
export const TableIcon = () => <Table />;
export const TocIcon = () => <Book />;
export const FootnoteIcon = () => <FileText />;
export const CitationIcon = () => <FileSignature />;
export const ShapesIcon = () => <Star />;
export const FindIcon = () => <Search />;
export const NewIcon = () => <File />;
export const SaveAsIcon = () => <SaveAll />;
export const SymbolIcon = () => <Sigma />;
export const ContactIcon = () => <MessageSquare />;
export const UpdateIcon = () => <RefreshCw />;
export const PrintIcon = () => <Printer />;
export const ExportIcon = () => <FileUp />;
export const CloseIcon = () => <X />;
export const ShareIcon = () => <Share2 />;
export const InfoIcon = () => <Info />;
export const ClearFormattingIcon = () => <Eraser />;
export const IncreaseFontSizeIcon = () => <CaseSensitive style={{ transform: 'scale(1.2)' }}/>;
export const DecreaseFontSizeIcon = () => <CaseSensitive style={{ transform: 'scale(0.8)' }}/>;
export const CutIcon = () => <Scissors />;
export const CopyIcon = () => <Copy />;
export const PasteIcon = () => <ClipboardPaste />;
export const SettingsIcon = () => <Settings />;
export const TemplateIcon = () => <FilePlus />;
export const TextColorIcon = () => <Palette />;
export const HighlightColorIcon = () => <PaintBucket />;

export const ArrowLeftIcon = () => <ArrowLeft />;
export const ArrowRightIcon = () => <ArrowRight />;
export const ArrowUpIcon = () => <ArrowUp />;
export const ArrowDownIcon = () => <ArrowDown />;
export const SquareIcon = () => <Square />;
export const CircleIcon = () => <Circle />;
export const TriangleIcon = () => <Triangle style={{ transform: 'rotate(-90deg)' }}/>;
export const StarIcon = () => <Star />;
export const HeartIcon = () => <Heart />;
export const YinYangIcon = () => <Fan />;
export const PeaceIcon = () => <Hand />;

export const SmileIcon = () => <Smile />;
export const LaughIcon = () => <Laugh />;
export const SadCryIcon = () => <Frown />;
export const AngryIcon = () => <Angry />;
export const ThumbsUpIcon = () => <ThumbsUp />;
export const ThumbsDownIcon = () => <ThumbsDown />;

export const CloudIcon = () => <Cloud />;
export const SunIcon = () => <Sun />;
export const MoonIcon = () => <Moon />;
export const CloudDrizzleIcon = () => <CloudDrizzle />;
export const CloudLightningIcon = () => <CloudLightning />;
export const CloudRainIcon = () => <CloudRain />;
export const CloudSnowIcon = () => <CloudSnow />;
export const SunsetIcon = () => <Sunset />;
export const WindIcon = () => <Wind />;

export const NavigationIcon = () => <Navigation />;
export const MapPinIcon = () => <MapPin />;
export const GlobeIcon = () => <Globe />;
export const CompassIcon = () => <Compass />;
export const ShipIcon = () => <Ship />;
export const PlaneIcon = () => <Plane />;
export const TrainIcon = () => <Train />;
export const CarIcon = () => <Car />;
export const BikeIcon = () => <Bike />;

export const AwardIcon = () => <Award />;
export const BadgeIcon = () => <Badge />;
export const TrophyIcon = () => <Trophy />;
export const MedalIcon = () => <Medal />;
export const GiftIcon = () => <Gift />;
export const ToyBrickIcon = () => <ToyBrick />;
export const Gamepad2Icon = () => <Gamepad2 />;
export const GlassesIcon = () => <Glasses />;

export const MusicIcon = () => <Music />;
export const ClapperboardIcon = () => <Clapperboard />;
export const FilmIcon = () => <Film />;
export const RadioIcon = () => <Radio />;
export const PodcastIcon = () => <Podcast />;
export const MicIcon = () => <Mic />;
export const WebcamIcon = () => <Webcam />;
export const VideoIcon = () => <Video />;

export const iconList = {
    shapes: [
        { name: 'Square', icon: SquareIcon },
        { name: 'Circle', icon: CircleIcon },
        { name: 'Triangle', icon: TriangleIcon },
        { name: 'Star', icon: StarIcon },
        { name: 'Heart', icon: HeartIcon },
        { name: 'Award', icon: AwardIcon },
        { name: 'Badge', icon: BadgeIcon },
        { name: 'Trophy', icon: TrophyIcon },
        { name: 'Medal', icon: MedalIcon },
        { name: 'Gift', icon: GiftIcon },
        { name: 'Toy Brick', icon: ToyBrickIcon },
        { name: 'Gamepad', icon: Gamepad2Icon },
        { name: 'Glasses', icon: GlassesIcon },
    ],
        symbols: [
        { name: 'Yin Yang', icon: YinYangIcon },
        { name: 'Peace', icon: PeaceIcon },
        { name: 'Arrow Left', icon: ArrowLeftIcon },
        { name: 'Arrow Right', icon: ArrowRightIcon },
        { name: 'Arrow Up', icon: ArrowUpIcon },
        { name: 'Arrow Down', icon: ArrowDownIcon },
        { name: 'Navigation', icon: NavigationIcon },
        { name: 'Map Pin', icon: MapPinIcon },
        { name: 'Globe', icon: GlobeIcon },
        { name: 'Compass', icon: CompassIcon },
        { name: 'Ship', icon: ShipIcon },
    ],
    emojis: [
        { name: 'Smile', icon: SmileIcon },
        { name: 'Laugh', icon: LaughIcon },
        { name: 'Sad', icon: SadCryIcon },
        { name: 'Angry', icon: AngryIcon },
        { name: 'Thumbs Up', icon: ThumbsUpIcon },
        { name: 'Thumbs Down', icon: ThumbsDownIcon },
        { name: 'Sun', icon: SunIcon },
        { name: 'Moon', icon: MoonIcon },
        { name: 'Cloud', icon: CloudIcon },
        { name: 'Cloud Drizzle', icon: CloudDrizzleIcon },
        { name: 'Cloud Lightning', icon: CloudLightningIcon },
        { name: 'Cloud Rain', icon: CloudRainIcon },
        { name: 'Cloud Snow', icon: CloudSnowIcon },
        { name: 'Sunset', icon: SunsetIcon },
        { name: 'Wind', icon: WindIcon },
    ],
    media: [
        { name: 'Music', icon: MusicIcon },
        { name: 'Clapperboard', icon: ClapperboardIcon },
        { name: 'Film', icon: FilmIcon },
        { name: 'Radio', icon: RadioIcon },
        { name: 'Podcast', icon: PodcastIcon },
        { name: 'Mic', icon: MicIcon },
        { name: 'Webcam', icon: WebcamIcon },
        { name: 'Video', icon: VideoIcon },
    ]
};