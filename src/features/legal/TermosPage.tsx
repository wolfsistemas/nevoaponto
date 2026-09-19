import { Link } from 'react-router-dom'
import { LegalLayout, Lista, Secao } from './LegalLayout'
import { BRAND, LEGAL, ROUTES } from '@/lib/brand'

export function TermosPage() {
  return (
    <LegalLayout titulo="Termos de Uso">
      <Secao titulo="1. Aceitacao">
        <p>
          Estes Termos regulam o uso da plataforma {BRAND.name}, operada por {LEGAL.razaoSocial},
          CNPJ {LEGAL.cnpj}. Ao criar uma conta ou utilizar o servico, voce concorda integralmente
          com estas condicoes e com a nossa{' '}
          <Link to={ROUTES.privacidade} className="font-semibold text-primary hover:underline">
            Politica de Privacidade
          </Link>
          .
        </p>
      </Secao>

      <Secao titulo="2. Descricao do servico">
        <p>
          O {BRAND.name} e um software como servico (SaaS) para registro de ponto, controle de
          jornada, gestao de obras, calculo de folha de pagamento e emissao de recibos. O servico e
          fornecido "no estado em que se encontra", podendo evoluir, ser atualizado ou
          descontinuado mediante aviso.
        </p>
      </Secao>

      <Secao titulo="3. Cadastro e conta">
        <Lista
          itens={[
            'Voce e responsavel pela veracidade dos dados informados no cadastro da empresa e dos usuarios.',
            'As credenciais de acesso sao pessoais e intransferiveis, sendo o titular responsavel pela sua guarda.',
            'O administrador da empresa e responsavel por gerenciar os usuarios e permissoes da sua organizacao.',
            'Contas em periodo de teste podem ser convertidas para plano pago ou encerradas ao final do periodo.',
          ]}
        />
      </Secao>

      <Secao titulo="4. Obrigacoes do usuario">
        <Lista
          itens={[
            'Utilizar o sistema em conformidade com a legislacao trabalhista, previdenciaria e de protecao de dados.',
            'Nao inserir conteudo ilicito, ofensivo ou que viole direitos de terceiros.',
            'Nao tentar acessar dados de outras empresas, burlar mecanismos de seguranca ou explorar vulnerabilidades.',
            'Manter seus dados cadastrais atualizados.',
          ]}
        />
      </Secao>

      <Secao titulo="5. Planos e pagamentos">
        <p>
          Os planos, limites e valores sao apresentados na pagina de precos. O nao pagamento pode
          acarretar suspensao do acesso. Eventuais reajustes serao comunicados previamente.
        </p>
      </Secao>

      <Secao titulo="6. Propriedade intelectual">
        <p>
          A marca, o codigo-fonte, o layout e a documentacao do {BRAND.name} pertencem a{' '}
          {LEGAL.razaoSocial}. Os dados inseridos pela empresa continuam sendo de sua propriedade,
          sendo tratados na forma da Politica de Privacidade.
        </p>
      </Secao>

      <Secao titulo="7. Limitacao de responsabilidade">
        <p>
          O {BRAND.name} e uma ferramenta de apoio. A conferencia final das informacoes de ponto e
          folha, bem como o cumprimento das obrigacoes legais, permanece sob responsabilidade da
          empresa contratante. Nao nos responsabilizamos por lucros cessantes, perda de dados
          decorrente de uso indevido ou casos fortuitos e de forca maior.
        </p>
      </Secao>

      <Secao titulo="8. Suspensao e encerramento">
        <p>
          Podemos suspender ou encerrar contas que violem estes Termos, a legislacao vigente ou
          representem risco a seguranca da plataforma. O usuario pode encerrar a conta a qualquer
          momento, observadas as obrigacoes de retencao legal de dados.
        </p>
      </Secao>

      <Secao titulo="9. Alteracoes">
        <p>
          Estes Termos podem ser atualizados. A versao vigente sera sempre publicada nesta pagina,
          com a data de atualizacao. O uso continuado apos alteracoes implica concordancia.
        </p>
      </Secao>

      <Secao titulo="10. Foro e legislacao">
        <p>
          Aplica-se a legislacao brasileira. Fica eleito o foro da comarca da sede de{' '}
          {LEGAL.razaoSocial} para dirimir eventuais conflitos, salvo disposicao legal em contrario.
        </p>
      </Secao>

      <Secao titulo="11. Contato">
        <p>
          Duvidas sobre estes Termos podem ser enviadas para{' '}
          <a href={`mailto:${BRAND.supportEmail}`} className="font-semibold text-primary hover:underline">
            {BRAND.supportEmail}
          </a>
          .
        </p>
      </Secao>
    </LegalLayout>
  )
}
