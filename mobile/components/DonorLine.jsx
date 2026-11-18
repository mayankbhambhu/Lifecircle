import { Feather } from '@expo/vector-icons'
import { Linking, Pressable, View } from 'react-native'
import { useTheme } from '../lib/theme'
import { Avatar, Row, T } from './ui'

/** Staff-only donor row: full name and a tap-to-call phone number. */
export default function DonorLine({ d, right, sub }) {
  const t = useTheme()
  if (!d) return <T faint>—</T>
  return (
    <Row>
      <Avatar name={d.name || d.display_name} size={38} />
      <View style={{ flex: 1 }}>
        <T weight="700" numberOfLines={1}>{d.name || d.display_name}</T>
        {d.phone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${d.phone.replace(/\s/g, '')}`)} hitSlop={6}>
            <Row gap={4}><Feather name="phone" size={11} color={t.primary} /><T size={12.5} color={t.primary} weight="600">{d.phone}</T></Row>
          </Pressable>
        ) : null}
        {!!sub && <T faint size={12}>{sub}</T>}
      </View>
      {right}
    </Row>
  )
}
