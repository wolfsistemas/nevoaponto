import { Link } from 'react-router-dom'
import { LegalLayout, Lista, Secao } from './LegalLayout'
import { BRAND, LEGAL, ROUTES } from '@/lib/brand'

export function PrivacidadePage() {
  return (
    <LegalLayout titulo="Politica de Privacidade">
      <Secao titulo="1. Compromisso">
        <p>
          Esta Politica descreve como o {BRAND.name}, operado por {LEGAL.razaoSocial}, trata dados
          pessoais em conformidade com a Lei Geral de Protecao de Dados (Lei 13.709/2018 - LGPD).
          Ao usar a plataforma, voce declara estar ciente das praticas aqui descritas.
        </p>
      </Secao>

      <Secao titulo="2. Papeis no tratamento">
        <p>
          A empresa contratante e a <strong>controladora</strong> dos dados de seus colaboradores,
          definindo finalidades e bases legais. O {BRAND.name} atua como <strong>operador</strong>,
          tratando os dados conforme as instrucoes da controladora e para a prestacao do servico.
        </p>
      </Secao>

      <Secao titulo="3. Dados tratados">
        <Lista
          itens={[
            'Dados cadastrais: nome, e-mail, telefone, documento, matricula e dados contratuais.',
            'Dados de jornada: horarios de entrada e saida, intervalos, pausas e ocorrencias de ponto.',
            'Dados de localizacao: latitude e longitude no momento do registro, quando a funcao for habilitada.',
            'Dados de imagem: foto de confirmacao do registro, quando habilitado pela empresa.',
            'Dados biometricos de face: vetor numerico de verificacao facial, quando habilitado pela empresa (dado sensivel).',
            'Dados de uso e tecnicos: logs de acesso, endereco IP, dispositivo, data e hora de operacoes.',
          ]}
        />
      </Secao>

      <Secao titulo="4. Finalidades e bases legais">
        <Lista
          itens={[
            'Execucao do contrato de trabalho e cumprimento de obrigacoes legais (registro de jornada, folha e encargos).',
            'Legitimo interesse para seguranca, prevencao a fraude e melhoria do servico.',
            'Consentimento especifico para imagem e biometria facial, que podem ser revogados pela empresa a qualquer momento.',
            'Exercicio regular de direitos em processos administrativos ou judiciais.',
          ]}
        />
      </Secao>

      <Secao titulo="5. Dados sensiveis e biometria">
        <p>
          O uso de foto e de verificacao facial e <strong>opcional</strong> e configurado pela empresa
          por obra. Quando habilitado, o tratamento ocorre com base no consentimento e para a
          finalidade especifica de confirmar a autenticidade do registro de ponto. Nao utilizamos
          biometria para outras finalidades nem a compartilhamos com terceiros para fins publicitarios.
        </p>
      </Secao>

      <Secao titulo="6. Compartilhamento">
        <p>
          Os dados podem ser processados por fornecedores de infraestrutura em nuvem e pelo Supabase,
          que atuam como operadores/suboperadores, sempre sob obrigacoes de confidencialidade e
          seguranca. Tambem podemos compartilhar dados quando exigido por lei ou ordem judicial.
        </p>
      </Secao>

      <Secao titulo="7. Retencao e eliminacao">
        <p>
          Os dados de jornada e folha sao mantidos pelo prazo necessario ao cumprimento de
          obrigacoes legais, trabalhistas, previdenciarias e fiscais. Dados de imagem e biometria
          podem ser eliminados a pedido da empresa. Apos os prazos aplicaveis, os dados sao
          eliminados ou anonimizados.
        </p>
      </Secao>

      <Secao titulo="8. Seguranca">
        <Lista
          itens={[
            'Transmissao criptografada (HTTPS/TLS).',
            'Isolamento por empresa no banco de dados, com regras de acesso por perfil (RLS).',
            'Controle de acesso por papeis: administrador, encarregado e funcionario.',
            'Registro de auditoria das principais operacoes.',
            'Principio da minimizacao: coletamos apenas o necessario para cada finalidade.',
          ]}
        />
      </Secao>

      <Secao titulo="9. Direitos do titular">
        <p>Nos termos da LGPD, o titular pode solicitar:</p>
        <Lista
          itens={[
            'Confirmacao da existencia de tratamento e acesso aos dados.',
            'Correcao de dados incompletos, inexatos ou desatualizados.',
            'Anonimizacao, bloqueio ou eliminacao de dados desnecessarios ou excessivos.',
            'Portabilidade, informacao sobre compartilhamento e revogacao do consentimento.',
            'Oposicao a tratamentos realizados sem o seu consentimento.',
          ]}
        />
        <p>
          As solicitacoes devem ser feitas preferencialmente a empresa empregadora (controladora) ou,
          se necessario, ao nosso encarregado em{' '}
          <a href={`mailto:${LEGAL.dpoEmail}`} className="font-semibold text-primary hover:underline">
            {LEGAL.dpoEmail}
          </a>
          .
        </p>
      </Secao>

      <Secao titulo="10. Cookies e armazenamento local">
        <p>
          Utilizamos armazenamento local apenas para manter a sessao autenticada e as preferencias de
          interface (como o tema claro/escuro). Nao utilizamos cookies de publicidade de terceiros.
        </p>
      </Secao>

      <Secao titulo="11. Alteracoes e contato">
        <p>
          Esta Politica pode ser atualizada; a versao vigente estara sempre nesta pagina. Duvidas
          podem ser enviadas para{' '}
          <a href={`mailto:${LEGAL.dpoEmail}`} className="font-semibold text-primary hover:underline">
            {LEGAL.dpoEmail}
          </a>{' '}
          ou consulte tambem os{' '}
          <Link to={ROUTES.termos} className="font-semibold text-primary hover:underline">
            Termos de Uso
          </Link>
          .
        </p>
      </Secao>
    </LegalLayout>
  )
}
