import * as Primitive from '@radix-ui/react-tabs'
import './ui.css'
export const Tabs = (props: Primitive.TabsProps) => <Primitive.Root {...props} className={`planning-ui-tabs ${props.className ?? ''}`} />
export const TabsList = Primitive.List
export const TabsTrigger = Primitive.Trigger
export const TabsContent = Primitive.Content
