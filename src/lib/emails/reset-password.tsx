import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface ResetPasswordEmailProps {
  name: string
  url: string
}

export function ResetPasswordEmail({ name, url }: ResetPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your oh8oh password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Password Reset</Heading>
          <Text style={text}>Hi {name},</Text>
          <Text style={text}>
            Someone requested a password reset for your oh8oh account. Click
            the button below to set a new password.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={url}>
              Reset Password
            </Button>
          </Section>
          <Text style={muted}>
            If you didn't request this, you can safely ignore this email. The
            link will expire in 1 hour.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>oh8oh — Bangalore Events</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#09090b',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '40px 24px',
  maxWidth: '480px',
}

const heading = {
  color: '#fafafa',
  fontSize: '24px',
  fontWeight: '600' as const,
  margin: '0 0 24px',
}

const text = {
  color: '#d4d4d8',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
}

const button = {
  backgroundColor: '#fafafa',
  borderRadius: '6px',
  color: '#09090b',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600' as const,
  lineHeight: '100%',
  padding: '12px 24px',
  textDecoration: 'none',
}

const muted = {
  color: '#71717a',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 16px',
}

const hr = {
  borderColor: '#27272a',
  margin: '24px 0',
}

const footer = {
  color: '#52525b',
  fontSize: '12px',
  margin: '0',
}
